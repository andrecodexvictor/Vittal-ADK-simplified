import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'
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
process.env.CRM_BASE_URL = 'https://crm.test.local'
process.env.CRM_BEARER_TOKEN = 'test-crm-token'
process.env.FEATURE_ACIONAR_ATENDENTE = 'true'

type Tool = {
  name: string
  execute(input: any, context: any): Promise<any>
}

let tools: Tool[]
let resetCrmState: () => void

beforeAll(async () => {
  const { loadManifest } = await import('../../../../src/core/manifest')
  const { getActiveTools } = await import('../../../../src/core/plugins')
  const { __resetCrmState } = await import('../../../../src/services/CrmClient')
  resetCrmState = __resetCrmState
  const agentDir = process.env.AGENT_DIR
  if (!agentDir) throw new Error('AGENT_DIR ausente no teste')
  const manifest = loadManifest(agentDir)
  tools = getActiveTools(manifest)
})

beforeEach(() => {
  resetCrmState()
})

function getTool(name: string): Tool {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Tool não encontrada: ${name}`)
  return tool
}

function createToolContext() {
  const state = {
    metadata: {} as Record<string, any>,
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

describe('AprovaAuto CRM tools', () => {
  test('registra as tools de CRM no manifest do agente', () => {
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'tool_crm_get_contact',
        'tool_crm_upsert_lead',
        'tool_crm_log_interaction',
      ]),
    )
  })

  test('recupera contato no CRM por telefone e salva no estado', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: Parameters<typeof fetch>[0]) => {
      expect(String(url)).toContain('/contacts/search')
      expect(String(url)).toContain('phone=551188887777')
      return Response.json({
        contact_id: 'c-1',
        name: 'Cliente Teste',
        phone: '551188887777',
        is_member: true,
        open_lead_id: 'lead-9',
        tags: ['vip'],
      })
    }) as unknown as typeof fetch

    try {
      const { ctx, state } = createToolContext()
      const output = await getTool('tool_crm_get_contact').execute({ phone: '551188887777' }, ctx)

      expect(output).toMatchObject({ contactId: 'c-1', isMember: true, openLeadId: 'lead-9' })
      expect(output.tags).toEqual(['vip'])
      expect(state.metadata.aprovauto_state).toMatchObject({ crmContact: { contactId: 'c-1' } })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('cria/atualiza lead comercial enviando nome e telefone normalizados', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(String(url)).toContain('/leads')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ name: 'Maria', phone: '5511988887777', stage: 'handoff_sales' })
      return Response.json({ lead_id: 'lead-1', stage: 'handoff_sales' })
    }) as unknown as typeof fetch

    try {
      const { ctx, state } = createToolContext()
      const output = await getTool('tool_crm_upsert_lead').execute(
        { name: 'Maria', phone: '+55 (11) 98888-7777', modelName: 'Onix 2022', stage: 'handoff_sales' },
        ctx,
      )

      expect(output).toMatchObject({ leadId: 'lead-1', stage: 'handoff_sales' })
      expect(state.metadata.aprovauto_state).toMatchObject({ crmLead: { leadId: 'lead-1' } })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('registra interação/resumo no CRM', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(String(url)).toContain('/interactions')
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ summary: 'Lead quer cotar Onix', outcome: 'qualified' })
      return Response.json({ interaction_id: 'int-1', logged_at: '2026-06-22T12:00:00Z' })
    }) as unknown as typeof fetch

    try {
      const { ctx } = createToolContext()
      const output = await getTool('tool_crm_log_interaction').execute(
        { phone: '551188887777', summary: 'Lead quer cotar Onix', outcome: 'qualified' },
        ctx,
      )

      expect(output).toMatchObject({ interactionId: 'int-1' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('falha de CRM exige handoff e pausa o agente sem expor erro técnico', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('erro interno', { status: 500 })) as unknown as typeof fetch

    try {
      const { ctx, state } = createToolContext()
      const output = await getTool('tool_crm_upsert_lead').execute({ name: 'João', phone: '551188887777' }, ctx)

      expect(output.handoffRequired).toBe(true)
      expect(output.error).toBe('crm_unavailable')
      expect(state.paused).toBe(true)
      expect(state.handoffMessages.length).toBeGreaterThan(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
