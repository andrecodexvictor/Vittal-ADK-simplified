import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

process.env.NODE_ENV = 'test'
process.env.AGENT_DIR = join(process.cwd(), 'agents', 'aprovauto-financeiro', 'whatsapp')
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
process.env.FEATURE_ACIONAR_ATENDENTE = 'true'

type Tool = {
  name: string
  execute(input: any, context: any): Promise<any>
}

let tools: Tool[]
let resetSgaState: () => void

beforeAll(async () => {
  const { loadManifest } = await import('../../../../src/core/manifest')
  const { getActiveTools } = await import('../../../../src/core/plugins')
  const { __resetSgaState } = await import('../../../../src/services/SgaClient')
  resetSgaState = __resetSgaState
  const manifest = loadManifest(process.env.AGENT_DIR as string)
  tools = getActiveTools(manifest)
})

beforeEach(() => {
  resetSgaState()
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
      conversationId: 'conv-fin-1',
      executionId: 'exec-fin-1',
      instanceName: 'instance-fin',
      senderPhone: '551188887777',
      contactName: 'Associado Teste',
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

function mockSga(handler: (href: string, init: any) => Response) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const href = String(url)
    if (href.includes('/usuario/autenticar')) {
      return Response.json({ mensagem: 'OK', token_usuario: 'sim-token' })
    }
    return handler(href, init)
  }) as unknown as typeof fetch
  return () => {
    globalThis.fetch = originalFetch
  }
}

describe('AprovaAuto Financeiro — manifest e allowlist de tools', () => {
  test('expõe SOMENTE handoff + 2ª via (allowlist config.tools do custom.sga)', () => {
    const names = tools.map((tool) => tool.name).sort()
    expect(names).toEqual(['human_handoff', 'tool_sga_get_financial_invoice'].sort())
  })

  test('NÃO expõe tools de cotação/sinistro pelo número financeiro', () => {
    const names = tools.map((tool) => tool.name)
    for (const forbidden of [
      'tool_sga_search_vehicle',
      'tool_sga_simulate_quote',
      'tool_sga_create_claim',
      'tool_sga_upload_claim_document',
      'tool_sga_get_claim_status',
      'tool_sga_list_products',
    ]) {
      expect(names).not.toContain(forbidden)
    }
  })
})

describe('AprovaAuto Financeiro — 2ª via com LGPD', () => {
  test('consulta boleto/periodo com CPF e retorna fatura da placa validada', async () => {
    const restore = mockSga((href, init) => {
      expect(href).toContain('/listar/boleto/periodo')
      const body = JSON.parse(String(init?.body))
      expect(body.cpf_associado).toBe('12345678900')
      expect(body.data_vencimento_inicial).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
      expect(body.data_vencimento_final).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
      return Response.json([
        {
          nosso_numero: 555,
          placa: 'FIN1A23',
          data_vencimento: '10/08/2026',
          valor_boleto: '199,90',
          situacao_boleto: 'ABERTO',
          linha_digitavel: '00190.00009 01234.567890 12345.678901 1 99990000019990',
          link_boleto: 'https://boletos.test/555.pdf',
        },
      ])
    })
    try {
      const { ctx } = createToolContext()
      const output = await getTool('tool_sga_get_financial_invoice').execute(
        { cpf: '123.456.789-00', plate: 'fin-1a23' },
        ctx,
      )
      restore()
      expect(output.authorized).toBe(true)
      expect(output.invoices?.length).toBe(1)
      expect(output.invoices[0].boletoPdfUrl).toContain('555.pdf')
    } finally {
      restore()
    }
  })
})
