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
  const agentDir = process.env.AGENT_DIR
  if (!agentDir) throw new Error('AGENT_DIR ausente no teste')
  const manifest = loadManifest(agentDir)
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

/**
 * Mocks the Hinova two-step auth (every non-auth call needs a token_usuario first),
 * then delegates the business endpoint to `handler`.
 */
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

describe('whitelist phone normalization', () => {
  test('aceita variante brasileira com ou sem nono digito', async () => {
    const { buildPhoneWhitelistSet, normalizePhoneIdentifier } = await import('../../../../src/core/ProcessMessage')

    const whitelist = buildPhoneWhitelistSet('+55 (77) 99909-5690')

    expect(whitelist.has('5577999095690')).toBe(true)
    expect(whitelist.has('557799095690')).toBe(true)
    expect(whitelist.has(normalizePhoneIdentifier('557799095690@s.whatsapp.net'))).toBe(true)
  })
})

describe('AprovaAuto SGA tools (Hinova v2 real endpoints)', () => {
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

  test('autentica (two-step) e busca veículo por placa no endpoint real', async () => {
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
        { codigo_veiculo: '1001', placa: 'ABC1D23', modelo: 'ONIX 1.0', marca: 'CHEVROLET', valor_fipe: '45000,00', codigo_regional: '9', codigo_tipo_veiculo: '1', ano_modelo: '2022' },
      ])
    }) as unknown as typeof fetch

    try {
      const { ctx, state } = createToolContext()
      const output = await getTool('tool_sga_search_vehicle').execute({ plate: 'abc-1d23' }, ctx)
      expect(authCalled).toBe(true)
      expect(output).toMatchObject({ plate: 'ABC1D23', fipeValue: 45000, codigoRegional: 9 })
      expect(state.metadata.aprovauto_state?.lead?.vehicle?.plate).toBe('ABC1D23')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('consulta faturas (boleto/periodo) somente com CPF e placa autorizados', async () => {
    const restore = mockSga((href, init) => {
      expect(href).toContain('/listar/boleto/periodo')
      const body = JSON.parse(String(init?.body))
      expect(body.cpf_associado).toBe('12345678900')
      return Response.json([
        {
          nosso_numero: 778899,
          data_vencimento: '2026-06-10',
          valor_boleto: '145,00',
          situacao_boleto: 'ABERTO',
          linha_digitavel: '00190.00009 01234',
          link_boleto: 'https://sga/boleto/778899.pdf',
          veiculos: [{ placa: 'ABC1D23', modelo: 'ONIX' }],
        },
      ])
    })

    try {
      const { ctx, state } = createToolContext()
      const output = await getTool('tool_sga_get_financial_invoice').execute({ cpf: '123.456.789-00', plate: 'abc1d23' }, ctx)
      expect(output.authorized).toBe(true)
      expect(output.invoices).toHaveLength(1)
      expect(output.invoices[0]).toMatchObject({ invoiceId: '778899', amount: 145, barcode: '00190.00009 01234' })
      expect(state.paused).toBe(false)
    } finally {
      restore()
    }
  })

  test('nega dados financeiros e pausa o agente quando CPF e placa divergem', async () => {
    const restore = mockSga(() =>
      Response.json([
        { nosso_numero: 1, data_vencimento: '2026-06-10', valor_boleto: '145,00', situacao_boleto: 'ABERTO', veiculos: [{ placa: 'XYZ9D87' }] },
      ]),
    )

    try {
      const { ctx, state } = createToolContext()
      const output = await getTool('tool_sga_get_financial_invoice').execute({ cpf: '12345678900', plate: 'ABC1D23' }, ctx)
      expect(output.authorized).toBe(false)
      expect(output.handoffRequired).toBe(true)
      expect(output.invoices).toHaveLength(0)
      expect(state.paused).toBe(true)
    } finally {
      restore()
    }
  })

  test('cria sinistro e anexa documento por base64 (foto/cadastrar)', async () => {
    const restore = mockSga((href, init) => {
      if (href.includes('/cadastrar/historico-atendimento-associado')) {
        return Response.json({ mensagem: 'OK', codigo_historico_atendimento: '551' })
      }
      if (href.includes('/historico-atendimento-associado/foto/cadastrar')) {
        const body = JSON.parse(String(init?.body))
        expect(body.codigo_atendimento).toBe(551)
        expect(body.foto[0].binario).toBeTruthy()
        return Response.json([{ nome_arquivo: 'cnh.jpg', situacao: 'Inserido' }])
      }
      return Response.json({})
    })

    try {
      const { ctx } = createToolContext()
      const claim = await getTool('tool_sga_create_claim').execute(
        { cpf: '32165498799', plate: 'ABC1D23', dateTime: '2026-06-22 08:30', location: 'Av. Paulista', description: 'Colisão traseira na lateral', hasThirdParty: false },
        ctx,
      )
      expect(claim).toMatchObject({ claimId: '551' })

      ;(ctx as any).currentMedia = {
        type: 'image',
        dataUri: `data:image/jpeg;base64,${Buffer.from('fake-jpeg').toString('base64')}`,
        mimeType: 'image/jpeg',
      }
      const upload = await getTool('tool_sga_upload_claim_document').execute({ claimId: '551', docType: 'cnh' }, ctx)
      expect(upload).toMatchObject({ uploaded: true })
    } finally {
      restore()
    }
  })

  test('consulta status de sinistro por placa (evento-veiculo)', async () => {
    const restore = mockSga((href) => {
      expect(href).toContain('/listar/evento-veiculo/ABC1D23')
      return Response.json({ eventos: [{ protocolo: 'SIN-2026-9847', situacao_evento: 'EM ANALISE', data_evento: '2026-06-15', descricao_motivo: 'COLISÃO' }] })
    })

    try {
      const { ctx } = createToolContext()
      const output = await getTool('tool_sga_get_claim_status').execute({ plate: 'ABC1D23' }, ctx)
      expect(output).toMatchObject({ claimId: 'SIN-2026-9847', status: 'EM ANALISE' })
    } finally {
      restore()
    }
  })

  test('abre circuit breaker após três falhas SGA e exige handoff', async () => {
    let businessCalls = 0
    const restore = mockSga(() => {
      businessCalls += 1
      return new Response('erro', { status: 500 })
    })

    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { ctx } = createToolContext()
        const output = await getTool('tool_sga_search_vehicle').execute({ plate: 'ABC1D23' }, ctx)
        expect(output.handoffRequired).toBe(true)
      }
      const { ctx } = createToolContext()
      const output = await getTool('tool_sga_search_vehicle').execute({ plate: 'ABC1D23' }, ctx)
      expect(output.handoffRequired).toBe(true)
      // After 3 failures the breaker is open, so the 4th never reaches the business endpoint.
      expect(businessCalls).toBe(3)
    } finally {
      restore()
    }
  })
})
