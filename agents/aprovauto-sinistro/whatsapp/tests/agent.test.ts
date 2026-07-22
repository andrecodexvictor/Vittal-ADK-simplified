import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

process.env.NODE_ENV = 'test'
process.env.AGENT_DIR = join(process.cwd(), 'agents', 'aprovauto-sinistro', 'whatsapp')
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
      conversationId: 'conv-sin-1',
      executionId: 'exec-sin-1',
      instanceName: 'instance-sin',
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

describe('AprovaAuto Sinistro — manifest e allowlist de tools', () => {
  test('expõe SOMENTE sinistro + busca de veículo + handoff (allowlist config.tools do custom.sga)', () => {
    const names = tools.map((tool) => tool.name).sort()
    expect(names).toEqual(
      [
        'human_handoff',
        'tool_sga_search_vehicle',
        'tool_sga_create_claim',
        'tool_sga_upload_claim_document',
        'tool_sga_get_claim_status',
      ].sort(),
    )
  })

  test('NÃO expõe tools de cotação/financeiro pelo número de sinistro', () => {
    const names = tools.map((tool) => tool.name)
    for (const forbidden of [
      'tool_sga_simulate_quote',
      'tool_sga_list_products',
      'tool_sga_get_financial_invoice',
      'tool_crm_get_contact',
      'tool_crm_upsert_lead',
      'tool_crm_log_interaction',
    ]) {
      expect(names).not.toContain(forbidden)
    }
  })
})

describe('AprovaAuto Sinistro — abertura e documentos', () => {
  test('cria sinistro e anexa documento por base64 (foto/cadastrar)', async () => {
    const restore = mockSga((href, init) => {
      if (href.includes('/cadastrar/historico-atendimento-associado')) {
        return Response.json({ mensagem: 'OK', codigo_historico_atendimento: '881' })
      }
      if (href.includes('/historico-atendimento-associado/foto/cadastrar')) {
        const body = JSON.parse(String(init?.body))
        expect(body.codigo_atendimento).toBe(881)
        expect(body.foto[0].binario).toBeTruthy()
        return Response.json([{ nome_arquivo: 'cnh.jpg', situacao: 'Inserido' }])
      }
      return Response.json({})
    })

    try {
      const { ctx } = createToolContext()
      const claim = await getTool('tool_sga_create_claim').execute(
        {
          cpf: '32165498799',
          plate: 'ABC1D23',
          dateTime: '2026-07-22 08:30',
          location: 'Av. Paulista',
          description: 'Colisão traseira na lateral',
          hasThirdParty: false,
        },
        ctx,
      )
      expect(claim).toMatchObject({ claimId: '881' })

      ;(ctx as any).currentMedia = {
        type: 'image',
        dataUri: `data:image/jpeg;base64,${Buffer.from('fake-jpeg').toString('base64')}`,
        mimeType: 'image/jpeg',
      }
      const upload = await getTool('tool_sga_upload_claim_document').execute({ claimId: '881', docType: 'cnh' }, ctx)
      expect(upload).toMatchObject({ uploaded: true })
    } finally {
      restore()
    }
  })

  test('bloqueia sinistro quando a placa não tem cobertura ativa (406)', async () => {
    let claimCreated = false
    const restore = mockSga((href) => {
      if (href.includes('/veiculo/buscar-por-permissao/')) {
        return Response.json({ mensagem: 'Não aceitável', error: ['Veículo não encontrado'] }, { status: 406 })
      }
      if (href.includes('/cadastrar/historico-atendimento-associado')) {
        claimCreated = true
        return Response.json({ mensagem: 'OK', codigo_historico_atendimento: '999' })
      }
      return Response.json({})
    })

    try {
      const { ctx } = createToolContext()
      const output = await getTool('tool_sga_create_claim').execute(
        {
          cpf: '32165498799',
          plate: 'ZZZ9Z99',
          dateTime: '2026-07-22 08:30',
          location: 'Rua X',
          description: 'Colisão na traseira esquerda',
          hasThirdParty: false,
        },
        ctx,
      )
      expect(output.coverageActive).toBe(false)
      expect(output.handoffRequired).toBe(true)
      expect(claimCreated).toBe(false)
    } finally {
      restore()
    }
  })

  test('consulta status de sinistro por placa (evento-veiculo)', async () => {
    const restore = mockSga((href) => {
      expect(href).toContain('/listar/evento-veiculo/ABC1D23')
      return Response.json({
        eventos: [
          { protocolo: 'SIN-2026-9847', situacao_evento: 'EM ANALISE', data_evento: '2026-07-15', descricao_motivo: 'COLISÃO' },
        ],
      })
    })

    try {
      const { ctx } = createToolContext()
      const output = await getTool('tool_sga_get_claim_status').execute({ plate: 'ABC1D23' }, ctx)
      expect(output).toMatchObject({ claimId: 'SIN-2026-9847', status: 'EM ANALISE' })
    } finally {
      restore()
    }
  })
})
