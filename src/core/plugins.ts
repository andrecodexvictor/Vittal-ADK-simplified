import { z } from 'zod'
import { config } from './config'
import { logger } from './logger'
import type { AgentManifest } from './manifest'
import { normalizeCpf, normalizePlate, SgaClient, SgaIntegrationError } from '../services/SgaClient'

export interface Tool {
  name: string
  description: string
  inputSchema: z.ZodType<any>
  execute(input: any, context: any): Promise<any>
}

// 1. Tool: human_handoff
const HandoffInputSchema = z.object({
  reason: z.string().optional(),
})

const handoffTool: Tool = {
  name: 'human_handoff',
  description: 'Transfere a conversa para atendimento humano. Use quando o cliente pedir uma pessoa ou quando a solicitação exigir intervenção humana.',
  inputSchema: HandoffInputSchema,
  execute: async (input, ctx) => {
    const { conversationId, executionId, instanceName, senderPhone, contactName, services } = ctx
    if (!services) {
      throw new Error('human_handoff requer services no contexto')
    }

    if (!config.featureAcionarAtendente) {
      logger.info('human_handoff executado mas FEATURE_ACIONAR_ATENDENTE=false (handoff desativado)')
      return { paused: false, attendantNotified: false, groupNotified: false }
    }

    // 1. Pausa o agente localmente e no Hub
    await services.handoff.pauseAgent(conversationId, services.repository)

    await services.repository.addLog(executionId, {
      level: 'warn',
      message: 'Human handoff initiated',
      data: { reason: input.reason ?? 'AI requested handoff' },
    })

    // 2. Notifica atendente via round-robin
    let attendantNotified = false
    const attendant = services.handoff.getNextAttendant()
    if (attendant) {
      const handoffMsg = `🔔 Novo atendimento solicitado\nCliente: ${contactName ?? senderPhone} (${senderPhone})`
      await services.publisher.publish(attendant, handoffMsg, instanceName, false)
      attendantNotified = true
    }

    // 3. Notifica grupo de atendimento
    let groupNotified = false
    if (config.featureGroupNotifications && config.handoffAnnouncementGroup) {
      const groupMsg = `🔔 Atendimento solicitado por ${contactName ?? senderPhone} (${senderPhone})`
      await services.publisher.publish(
        config.handoffAnnouncementGroup,
        groupMsg,
        instanceName,
        true,
        config.groupNotificationToken || undefined,
      )
      groupNotified = true
    }

    return { paused: true, attendantNotified, groupNotified }
  },
}

// 2. Tool: appointment_request_notification
const AppointmentInputSchema = z.object({
  payload: z.record(z.string(), z.unknown()).default({}),
})

const appointmentTool: Tool = {
  name: 'appointment_request_notification',
  description: 'Registra e notifica uma solicitação de agendamento quando o cliente confirmar que deseja agendar.',
  inputSchema: AppointmentInputSchema,
  execute: async (input, ctx) => {
    const { instanceName, senderPhone, contactName, services } = ctx
    if (!services) {
      throw new Error('appointment_request_notification requer services no contexto')
    }

    if (!config.featureGroupNotifications || !config.agendamentoAnnouncementGroup) {
      return { groupNotified: false }
    }

    const groupMsg = `🗓️ Novo agendamento solicitado por ${contactName ?? senderPhone} (${senderPhone})`
    await services.publisher.publish(
      config.agendamentoAnnouncementGroup,
      groupMsg,
      instanceName,
      true,
      config.groupNotificationToken || undefined,
    )

    return { groupNotified: true }
  },
}

const sgaClient = new SgaClient()

const SgaSearchVehicleInputSchema = z
  .object({
    plate: z.string().optional(),
    modelName: z.string().optional(),
  })
  .refine((input) => Boolean(input.plate?.trim() || input.modelName?.trim()), {
    message: 'Informe plate ou modelName',
  })

const SgaSimulateQuoteInputSchema = z.object({
  vehicleValue: z.number().positive(),
  hasTracker: z.boolean().default(false),
  coverages: z.array(z.string()).default([]),
})

const SgaGetFinancialInvoiceInputSchema = z.object({
  cpf: z.string().min(11),
  plate: z.string().min(7),
})

const SgaCreateClaimInputSchema = z.object({
  cpf: z.string().min(11),
  plate: z.string().min(7),
  dateTime: z.string().min(1),
  location: z.string().min(1),
  description: z.string().min(10),
  hasThirdParty: z.boolean().default(false),
  thirdPartyData: z.record(z.string(), z.unknown()).optional(),
})

const SgaUploadClaimDocumentInputSchema = z.object({
  claimId: z.string().min(1),
  docType: z.enum(['cnh', 'crlv', 'avarias', 'boletim_ocorrencia', 'outro']),
  fileUrl: z.string().optional(),
})

const SgaGetClaimStatusInputSchema = z
  .object({
    claimId: z.string().optional(),
    cpf: z.string().optional(),
  })
  .refine((input) => Boolean(input.claimId?.trim() || input.cpf?.trim()), {
    message: 'Informe claimId ou cpf',
  })

async function withSgaFailureHandoff<T>(ctx: any, operation: string, execute: () => Promise<T>): Promise<T> {
  try {
    return await execute()
  } catch (err) {
    const isSgaError = err instanceof SgaIntegrationError
    logger.error({ err, operation }, 'SGA tool failed')

    const services = ctx.services
    if (services) {
      await services.repository.addLog(ctx.executionId, {
        level: 'error',
        message: `SGA integration failed: ${operation}`,
        data: {
          error: err instanceof Error ? err.message : String(err),
          code: isSgaError ? err.code : 'tool-error',
        },
      })

      if (config.featureAcionarAtendente) {
        await triggerSgaHandoff(ctx, `Falha na integração SGA: ${operation}`)
      }
    }

    return {
      error: 'sga_unavailable',
      handoffRequired: true,
      userMessage:
        'O sistema SGA está instável no momento. Vou transferir seu atendimento para uma pessoa da equipe continuar com segurança.',
    } as T
  }
}

async function mergeAprovautoState(ctx: any, patch: Record<string, unknown>): Promise<void> {
  const services = ctx.services
  if (!services?.repository?.mergeConversationMetadata) return

  const metadata = await services.repository.getConversationMetadata(ctx.conversationId)
  const current = isRecord(metadata.aprovauto_state) ? metadata.aprovauto_state : {}
  await services.repository.mergeConversationMetadata(ctx.conversationId, {
    aprovauto_state: {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  })
}

async function triggerSgaHandoff(ctx: any, reason: string): Promise<void> {
  const services = ctx.services
  if (!services) return

  await services.handoff.pauseAgent(ctx.conversationId, services.repository)

  const attendant = services.handoff.getNextAttendant?.()
  if (attendant && services.publisher && ctx.instanceName && ctx.senderPhone) {
    const message = `🔔 Atendimento AprovaAuto solicitado\nCliente: ${ctx.contactName ?? ctx.senderPhone} (${ctx.senderPhone})\nMotivo: ${reason}`
    await services.publisher.publish(attendant, message, ctx.instanceName, false)
  }

  if (config.featureGroupNotifications && config.handoffAnnouncementGroup && services.publisher && ctx.instanceName) {
    const groupMessage = `🔔 Atendimento AprovaAuto solicitado\nCliente: ${ctx.contactName ?? ctx.senderPhone}\nMotivo: ${reason}`
    await services.publisher.publish(
      config.handoffAnnouncementGroup,
      groupMessage,
      ctx.instanceName,
      true,
      config.groupNotificationToken || undefined,
    )
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function resolveUploadFile(input: z.infer<typeof SgaUploadClaimDocumentInputSchema>, ctx: any): Promise<{
  file: Blob
  filename: string
  mimeType: string
}> {
  const dataUri = ctx.currentMedia?.dataUri ?? ctx.imageUrl
  if (dataUri?.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUri)
    if (!match) throw new Error('Imagem em data URI inválida')

    const mimeType = match[1]
    const base64 = match[2]
    if (!mimeType || !base64) throw new Error('Imagem em data URI inválida')
    const buffer = Buffer.from(base64, 'base64')
    validateUploadBuffer(buffer, mimeType)
    return {
      file: new Blob([buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)], { type: mimeType }),
      filename: `${input.docType}.${extensionFromMime(mimeType)}`,
      mimeType,
    }
  }

  if (input.fileUrl?.trim()) {
    const response = await fetch(input.fileUrl)
    if (!response.ok) throw new Error(`Falha ao baixar arquivo para upload: ${response.status}`)
    const mimeType = response.headers.get('content-type') ?? 'application/octet-stream'
    const buffer = Buffer.from(await response.arrayBuffer())
    validateUploadBuffer(buffer, mimeType)
    return {
      file: new Blob([buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)], { type: mimeType }),
      filename: `${input.docType}.${extensionFromMime(mimeType)}`,
      mimeType,
    }
  }

  throw new Error('Nenhum arquivo de mídia disponível para upload')
}

function validateUploadBuffer(buffer: Buffer, mimeType: string): void {
  if (buffer.byteLength > config.sgaMaxUploadBytes) {
    throw new Error(`Arquivo excede limite de ${config.sgaMaxUploadBytes} bytes`)
  }

  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  if (!allowedTypes.has(mimeType.toLowerCase())) {
    throw new Error(`Tipo de arquivo não permitido para sinistro: ${mimeType}`)
  }
}

function extensionFromMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase()
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'application/pdf') return 'pdf'
  return 'jpg'
}

const sgaSearchVehicleTool: Tool = {
  name: 'tool_sga_search_vehicle',
  description: 'Busca dados do veículo no SGA/FIPE por placa ou por modelo para cotações e validações.',
  inputSchema: SgaSearchVehicleInputSchema,
  execute: async (input, ctx) =>
    withSgaFailureHandoff(ctx, 'tool_sga_search_vehicle', async () => {
      const vehicle = await sgaClient.searchVehicle(input)
      await mergeAprovautoState(ctx, {
        lead: {
          vehicle,
          plate: vehicle.plate ?? input.plate,
          modelName: vehicle.modelName,
        },
      })
      return vehicle
    }),
}

const sgaSimulateQuoteTool: Tool = {
  name: 'tool_sga_simulate_quote',
  description: 'Calcula mensalidade estimada de proteção veicular no SGA.',
  inputSchema: SgaSimulateQuoteInputSchema,
  execute: async (input, ctx) =>
    withSgaFailureHandoff(ctx, 'tool_sga_simulate_quote', async () => {
      const quote = await sgaClient.simulateQuote(input)
      await mergeAprovautoState(ctx, { leadQuote: quote })
      return quote
    }),
}

const sgaGetFinancialInvoiceTool: Tool = {
  name: 'tool_sga_get_financial_invoice',
  description:
    'Consulta faturas em aberto somente após validar CPF e placa do contrato ativo. Nunca usar apenas CPF.',
  inputSchema: SgaGetFinancialInvoiceInputSchema,
  execute: async (input, ctx) =>
    withSgaFailureHandoff(ctx, 'tool_sga_get_financial_invoice', async () => {
      const cpf = normalizeCpf(input.cpf)
      const plate = normalizePlate(input.plate)
      const result = await sgaClient.getFinancialInvoice({ cpf, plate })
      const hasMismatch = result.invoices.some((invoice) => invoice.contractPlate && invoice.contractPlate !== plate)

      if (hasMismatch) {
        const services = ctx.services
        if (services && config.featureAcionarAtendente) {
          await services.repository.addLog(ctx.executionId, {
            level: 'warn',
            message: 'LGPD validation failed for financial invoice',
            data: { cpfLast4: cpf.slice(-4), plate },
          })
          await triggerSgaHandoff(ctx, 'Validação LGPD falhou para segunda via financeira')
        }

        return {
          authorized: false,
          handoffRequired: true,
          invoices: [],
          userMessage:
            'Não consegui confirmar com segurança que esse CPF pertence à placa informada. Vou transferir para o financeiro continuar sem expor seus dados.',
        }
      }

      await mergeAprovautoState(ctx, { financialValidation: { cpfLast4: cpf.slice(-4), plate, authorized: true } })
      return {
        authorized: true,
        invoices: result.invoices,
      }
    }),
}

const sgaCreateClaimTool: Tool = {
  name: 'tool_sga_create_claim',
  description: 'Cria a notificação preliminar de sinistro no SGA após coleta de CPF, placa, data, local e descrição.',
  inputSchema: SgaCreateClaimInputSchema,
  execute: async (input, ctx) =>
    withSgaFailureHandoff(ctx, 'tool_sga_create_claim', async () => {
      const claim = await sgaClient.createClaim(input)
      await mergeAprovautoState(ctx, {
        claim: {
          ...input,
          cpfLast4: normalizeCpf(input.cpf).slice(-4),
          cpf: undefined,
          claimId: claim.claimId,
          protocol: claim.protocol,
          status: claim.status,
          expectedNextDoc: 'cnh',
        },
      })
      return claim
    }),
}

const sgaUploadClaimDocumentTool: Tool = {
  name: 'tool_sga_upload_claim_document',
  description:
    'Anexa foto/documento recebido no WhatsApp a um sinistro SGA usando multipart/form-data. Use quando houver mídia atual ou fileUrl.',
  inputSchema: SgaUploadClaimDocumentInputSchema,
  execute: async (input, ctx) =>
    withSgaFailureHandoff(ctx, 'tool_sga_upload_claim_document', async () => {
      const file = await resolveUploadFile(input, ctx)
      const result = await sgaClient.uploadClaimDocument({
        claimId: input.claimId,
        docType: input.docType,
        file: file.file,
        filename: file.filename,
        mimeType: file.mimeType,
      })
      await mergeAprovautoState(ctx, {
        lastUploadedClaimDocument: {
          claimId: input.claimId,
          docType: input.docType,
          uploadedAt: new Date().toISOString(),
          documentId: result.documentId,
        },
      })
      return result
    }),
}

const sgaGetClaimStatusTool: Tool = {
  name: 'tool_sga_get_claim_status',
  description: 'Consulta status atual de sinistro no SGA por protocolo/claimId ou CPF.',
  inputSchema: SgaGetClaimStatusInputSchema,
  execute: async (input, ctx) =>
    withSgaFailureHandoff(ctx, 'tool_sga_get_claim_status', async () => {
      return sgaClient.getClaimStatus(input)
    }),
}

/**
 * Returns the active tools list for the agent based on manifest capabilities.
 */
export function getActiveTools(manifest: AgentManifest): Tool[] {
  const tools: Tool[] = []
  const capabilities = manifest.capabilities || []

  // Check if handoff capability is enabled
  if (capabilities.includes('handoff') || manifest.plugins.some((p) => p.id === 'builtin.handoff')) {
    tools.push(handoffTool)
  }

  // Check if appointment creation capability is enabled
  if (
    capabilities.includes('appointment_create') ||
    manifest.plugins.some((p) => p.id === 'builtin.appointment-request')
  ) {
    tools.push(appointmentTool)
  }

  if (manifest.slug === 'aprovauto-ai' || manifest.plugins.some((p) => p.id === 'custom.sga')) {
    tools.push(
      sgaSearchVehicleTool,
      sgaSimulateQuoteTool,
      sgaGetFinancialInvoiceTool,
      sgaCreateClaimTool,
      sgaUploadClaimDocumentTool,
      sgaGetClaimStatusTool,
    )
  }

  return tools
}
