import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

process.env.NODE_ENV = 'test'
process.env.AGENT_DIR = join(process.cwd(), 'agents', 'aprovauto-comercial', 'whatsapp')
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
process.env.SGA_USUARIO = 'test-user'
process.env.SGA_SENHA = 'test-pass'
process.env.CRM_BASE_URL = 'https://crm.test.local'
process.env.CRM_BEARER_TOKEN = 'test-crm-token'
process.env.FEATURE_ACIONAR_ATENDENTE = 'true'

type Tool = {
  name: string
  execute(input: any, context: any): Promise<any>
}

let tools: Tool[]
let resetSgaState: () => void
let resetCrmState: () => void

beforeAll(async () => {
  const { loadManifest } = await import('../../../../src/core/manifest')
  const { getActiveTools } = await import('../../../../src/core/plugins')
  const { __resetSgaState } = await import('../../../../src/services/SgaClient')
  const { __resetCrmState } = await import('../../../../src/services/CrmClient')
  resetSgaState = __resetSgaState
  resetCrmState = __resetCrmState
  const manifest = loadManifest(process.env.AGENT_DIR as string)
  tools = getActiveTools(manifest)
})

beforeEach(() => {
  resetSgaState()
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
  }
  return {
    state,
    ctx: {
      conversationId: 'conv-com-1',
      executionId: 'exec-com-1',
      instanceName: 'instance-com',
      senderPhone: '551188887777',
      contactName: 'Lead Teste',
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
        publisher: { async publish() {} },
        handoff: { async requestHumanHandoff() { return { attendant: '5511999999999' } } },
      },
    },
  }
}

describe('AprovaAuto Comercial — manifest e allowlist de tools', () => {
  test('expõe SOMENTE cotação SGA + CRM + handoff (allowlist config.tools do custom.sga)', () => {
    const names = tools.map((tool) => tool.name).sort()
    expect(names).toEqual(
      [
        'human_handoff',
        'tool_sga_search_vehicle',
        'tool_sga_simulate_quote',
        'tool_sga_list_products',
        'tool_crm_get_contact',
        'tool_crm_upsert_lead',
        'tool_crm_log_interaction',
      ].sort(),
    )
  })

  test('NÃO expõe tools de financeiro/sinistro pelo número comercial', () => {
    const names = tools.map((tool) => tool.name)
    for (const forbidden of [
      'tool_sga_get_financial_invoice',
      'tool_sga_create_claim',
      'tool_sga_upload_claim_document',
      'tool_sga_get_claim_status',
    ]) {
      expect(names).not.toContain(forbidden)
    }
  })
})

describe('AprovaAuto Comercial — fluxo de cotação', () => {
  test('autentica (two-step) e busca veículo por placa', async () => {
    const originalFetch = globalThis.fetch
    let authCalled = false
    globalThis.fetch = (async (url: Parameters<typeof fetch>[0]) => {
      const href = String(url)
      if (href.includes('/usuario/autenticar')) {
        authCalled = true
        return Response.json({ mensagem: 'OK', token_usuario: 'sim-token' })
      }
      expect(href).toContain('/veiculo/buscar-por-permissao/')
      expect(href).toContain('ABC1D23')
      return Response.json([
        {
          codigo_veiculo: '1001',
          placa: 'ABC1D23',
          modelo: 'ONIX 1.0',
          marca: 'CHEVROLET',
          valor_fipe: '45000,00',
          codigo_regional: '9',
          codigo_tipo_veiculo: '1',
          ano_modelo: '2022',
        },
      ])
    }) as unknown as typeof fetch

    try {
      const { ctx, state } = createToolContext()
      const output = await getTool('tool_sga_search_vehicle').execute({ plate: 'abc-1d23' }, ctx)
      expect(authCalled).toBe(true)
      expect(output).toMatchObject({ plate: 'ABC1D23', fipeValue: 45000 })
      expect(state.metadata.aprovauto_state?.lead?.vehicle?.plate).toBe('ABC1D23')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('AprovaAuto Comercial — lead no CRM antes do handoff de vendas', () => {
  test('cria/atualiza lead qualificado com stage handoff_sales', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(String(url)).toContain('/leads')
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

  test('registra resumo da conversa no CRM (log_interaction)', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(String(url)).toContain('/interactions')
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ summary: 'Lead quer cotar Onix 2022', outcome: 'qualified' })
      return Response.json({ interaction_id: 'int-1', logged_at: '2026-07-22T12:00:00Z' })
    }) as unknown as typeof fetch

    try {
      const { ctx } = createToolContext()
      const output = await getTool('tool_crm_log_interaction').execute(
        { phone: '551188887777', summary: 'Lead quer cotar Onix 2022', outcome: 'qualified' },
        ctx,
      )
      expect(output).toMatchObject({ interactionId: 'int-1' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
