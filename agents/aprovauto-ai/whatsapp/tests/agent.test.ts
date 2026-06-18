import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

process.env.NODE_ENV = 'test'
process.env.AGENT_DIR = join(process.cwd(), 'agents', 'aprovauto-ai', 'whatsapp')
process.env.WEBHOOK_SECRET = 'test-secret'
process.env.HUB_AGENT_KEY = 'test-agent-key'
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.RABBITMQ_URL = 'amqp://localhost'
process.env.RABBITMQ_EXCHANGE = 'test-exchange'
process.env.RABBITMQ_ROUTING_KEY = 'test-key'
process.env.UAZAPI_TOKEN = 'test-uazapi-token'
process.env.HANDOFF_ATTENDANTS = '5511999999999'
process.env.SGA_BASE_URL = 'https://sga.test.local'
process.env.SGA_API_TOKEN = 'test-sga-token'
process.env.FEATURE_ACIONAR_ATENDENTE = 'true'

type Tool = {
  name: string
  execute(input: any, context: any): Promise<any>
}

let tools: Tool[]

beforeAll(async () => {
  const { loadManifest } = await import('../../../../src/core/manifest')
  const { getActiveTools } = await import('../../../../src/core/plugins')
  const agentDir = process.env.AGENT_DIR
  if (!agentDir) throw new Error('AGENT_DIR ausente no teste')
  const manifest = loadManifest(agentDir)
  tools = getActiveTools(manifest)
})

function getTool(name: string): Tool {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Tool não encontrada: ${name}`)
  return tool
}

function createToolContext() {
  const state = {
    metadata: {} as Record<string, unknown>,
    paused: false,
    logs: [] as any[],
    handoffMessages: [] as any[],
  }

  return {
    state,
    ctx: {
      conversationId: 'conv-123',
      executionId: 'exec-123',
      instanceName: 'instance-test',
      senderPhone: '551188887777',
      contactName: 'Cliente Teste',
      services: {
        repository: {
          async addLog(_executionId: string, log: any) {
            state.logs.push(log)
          },
          async getConversationMetadata() {
            return state.metadata
          },
          async mergeConversationMetadata(_conversationId: string, patch: Record<string, unknown>) {
            state.metadata = { ...state.metadata, ...patch }
          },
          async setAgentState() {
            state.paused = true
          },
        },
        publisher: {
          async publish(phone: string, text: string) {
            state.handoffMessages.push({ phone, text })
          },
        },
        handoff: {
          getNextAttendant() {
            return '5511999999999'
          },
          async pauseAgent(_conversationId: string, repository: any) {
            await repository.setAgentState()
          },
        },
      },
    },
  }
}

describe('whitelist phone normalization', () => {
  test('aceita variante brasileira com ou sem nono digito', async () => {
    const { buildPhoneWhitelistSet, normalizePhoneIdentifier } = await import('../../../../src/core/ProcessMessage')

    const whitelist = buildPhoneWhitelistSet('+55 (77) 99909-5690')

    expect(whitelist.has('5577999095690')).toBe(true)
    expect(whitelist.has('557799095690')).toBe(true)
    expect(whitelist.has(normalizePhoneIdentifier('557799095690@s.whatsapp.net'))).toBe(true)
  })
})

describe('AprovaAuto SGA tools', () => {
  test('registra as tools transacionais no manifest do agente', () => {
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'tool_sga_search_vehicle',
        'tool_sga_simulate_quote',
        'tool_sga_get_financial_invoice',
        'tool_sga_create_claim',
        'tool_sga_upload_claim_document',
        'tool_sga_get_claim_status',
      ]),
    )
  })

  test('consulta faturas somente com CPF e placa autorizados', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(String(url)).toContain('/financial/invoices')
      expect(String(url)).toContain('cpf=12345678900')
      expect(String(url)).toContain('plate=ABC1D23')
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-sga-token' })

      return Response.json({
        invoices: [
          {
            id: 'fat-1',
            due_date: '2026-06-10',
            amount: 145,
            status: 'open',
            contract_plate: 'ABC1D23',
            pix: 'pix-copia-e-cola',
            linha_digitavel: '001900000',
          },
        ],
      })
    }) as unknown as typeof fetch

    try {
      const { ctx, state } = createToolContext()
      const output = await getTool('tool_sga_get_financial_invoice').execute(
        { cpf: '123.456.789-00', plate: 'abc1d23' },
        ctx,
      )

      expect(output.authorized).toBe(true)
      expect(output.invoices).toHaveLength(1)
      expect(state.paused).toBe(false)
      expect(state.metadata.aprovauto_state).toMatchObject({
        financialValidation: { cpfLast4: '8900', plate: 'ABC1D23', authorized: true },
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('nega dados financeiros e pausa o agente quando CPF e placa divergem', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      Response.json({
        invoices: [
          {
            id: 'fat-1',
            due_date: '2026-06-10',
            amount: 145,
            status: 'open',
            contract_plate: 'XYZ9D87',
          },
        ],
      })) as unknown as typeof fetch

    try {
      const { ctx, state } = createToolContext()
      const output = await getTool('tool_sga_get_financial_invoice').execute(
        { cpf: '12345678900', plate: 'ABC1D23' },
        ctx,
      )

      expect(output.authorized).toBe(false)
      expect(output.handoffRequired).toBe(true)
      expect(output.invoices).toHaveLength(0)
      expect(state.paused).toBe(true)
      expect(state.handoffMessages).toHaveLength(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('envia documento de sinistro como multipart/form-data usando a mídia atual', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(String(url)).toContain('/claims/SIN-1/documents')
      expect(init?.method).toBe('POST')
      expect(init?.body).toBeInstanceOf(FormData)
      const formData = init?.body as FormData
      expect(formData.get('claim_id')).toBe('SIN-1')
      expect(formData.get('doc_type')).toBe('cnh')
      expect(formData.get('file')).toBeInstanceOf(File)
      return Response.json({ document_id: 'doc-1' })
    }) as unknown as typeof fetch

    try {
      const { ctx } = createToolContext()
      ;(ctx as any).currentMedia = {
        type: 'image',
        dataUri: `data:image/jpeg;base64,${Buffer.from('fake-jpeg').toString('base64')}`,
        mimeType: 'image/jpeg',
      }

      const output = await getTool('tool_sga_upload_claim_document').execute(
        { claimId: 'SIN-1', docType: 'cnh' },
        ctx,
      )

      expect(output).toMatchObject({ uploaded: true, documentId: 'doc-1' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('abre circuit breaker após três falhas SGA e exige handoff', async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async () => {
      calls += 1
      return new Response('erro', { status: 500 })
    }) as unknown as typeof fetch

    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { ctx } = createToolContext()
        const output = await getTool('tool_sga_search_vehicle').execute({ plate: 'ABC1D23' }, ctx)
        expect(output.handoffRequired).toBe(true)
      }

      const { ctx } = createToolContext()
      const output = await getTool('tool_sga_search_vehicle').execute({ plate: 'ABC1D23' }, ctx)
      expect(output.handoffRequired).toBe(true)
      expect(calls).toBe(3)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
