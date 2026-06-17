import { z } from 'zod'
import { config } from './config'
import { logger } from './logger'
import type { AgentManifest } from './manifest'

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

  return tools
}
