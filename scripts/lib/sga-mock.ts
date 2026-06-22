/**
 * Deterministic Hinova SGA v2 mock — shared by the UAT runner (simulate-agent.ts)
 * and the interactive WhatsApp simulator (wa-sim-server.ts).
 *
 * Intercepts globalThis.fetch for SGA endpoints and lets all other traffic
 * (OpenAI) pass straight through. Endpoints/shapes mirror the real API contract
 * in agents/aprovauto-ai/whatsapp/spec/sga.openapi.json.
 */
const j = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

export function sgaMock(href: string, init?: RequestInit): Response {
  let body: any = {}
  try {
    body = init?.body ? JSON.parse(String(init.body)) : {}
  } catch {}

  if (href.includes('/usuario/autenticar')) return j({ mensagem: 'OK', token_usuario: 'sim-token' })

  if (href.includes('/veiculo/buscar-por-permissao/')) {
    if (/\/ABC1D23\//i.test(href))
      return j([
        {
          codigo_veiculo: '1001', placa: 'ABC1D23', modelo: 'ONIX 1.0 LT', marca: 'CHEVROLET',
          valor_fipe: '45000.00', codigo_regional: '9', codigo_tipo_veiculo: '1', cpf: '12345678900', ano_modelo: '2022',
        },
      ])
    return j({ mensagem: 'Não aceitável', error: ['Veículo não encontrado'] }, 406)
  }

  if (href.includes('/modelo/listar'))
    return j([
      { descricao_modelo: 'CIVIC EXL 2.0', descricao_marca: 'HONDA', codigo_modelo: '2001', codigo_tipo_veiculo: '1', situacao: 'ATIVO' },
      { descricao_modelo: 'COROLLA XEI 2.0', descricao_marca: 'TOYOTA', codigo_modelo: '2002', codigo_tipo_veiculo: '1', situacao: 'ATIVO' },
    ])

  if (href.includes('/buscar/rateio-medio')) return j({ mensagem: 'OK', valor_rateio_medio: 'R$ 189,50' })

  if (href.includes('/buscar/situacao-financeira-veiculo/')) {
    if (/\/ABC1D23/i.test(href)) return j({ cpf: '12345678900', nome: 'CARLOS EDUARDO SILVA', placa: 'ABC1D23', situacao_financeira: 'INADIMPLENTE' })
    if (/\/ZZZ9Z99/i.test(href)) return j({ cpf: '99988877766', nome: 'OUTRO TITULAR', placa: 'ZZZ9Z99', situacao_financeira: 'ADIMPLENTE' })
    return j({ mensagem: 'Não aceitável', error: ['Veículo não encontrado'] }, 406)
  }

  if (href.includes('/listar/boleto-associado/periodo'))
    return j([
      {
        nosso_numero: 778899, data_vencimento: '2026-06-10', valor_boleto: '145,00', situacao_boleto: 'ABERTO',
        quantidade_dias_vencidos: 12, codigo_associado: '5001', nome_associado: 'CARLOS EDUARDO SILVA',
        cpf: '12345678900', celular: '5511988887777', email: 'carlos@example.com',
        linha_digitavel: '00190.00009 01234.567890 12345.678901 2 99990000014500',
        link_boleto: 'https://sga.sim/boleto/778899.pdf', veiculos: [{ placa: 'ABC1D23', modelo: 'ONIX' }],
      },
    ])

  if (href.includes('/listar/boleto/periodo'))
    return j([
      {
        nosso_numero: 778899, data_vencimento: '2026-06-10', valor_boleto: '145,00', situacao_boleto: 'ABERTO',
        linha_digitavel: '00190.00009 01234.567890 12345.678901 2 99990000014500',
        link_boleto: 'https://sga.sim/boleto/778899.pdf',
        pix: { copia_cola: '00020126360014BR.GOV.BCB.PIX0114+5531999990000', qrcode: 'base64-qrcode' },
        veiculos: [{ placa: 'ABC1D23', modelo: 'ONIX' }],
      },
    ])

  if (href.includes('/cadastrar/historico-atendimento-associado')) return j({ mensagem: 'OK', codigo_historico_atendimento: '551' })

  if (href.includes('/historico-atendimento-associado/foto/cadastrar'))
    return j([{ nome_arquivo: body?.foto?.[0]?.nome_arquivo ?? 'doc.jpg', situacao: 'Inserido' }])

  if (href.includes('/listar/evento-veiculo/'))
    return j({ eventos: [{ protocolo: 'SIN-2026-9847', situacao_evento: 'EM ANALISE', data_evento: '2026-06-15', hora_evento: '09:00:00', envolvimento_terceiros: 'N', descricao_motivo: 'COLISÃO' }] })

  if (href.includes('/listar/evento'))
    return j([{ protocolo: body?.protocolo ?? 'SIN-2026-9847', situacao_evento: 'EM ANALISE', data_evento: '2026-06-15', hora_evento: '09:00:00', envolvimento_terceiros: 'N', descricao_motivo: 'COLISÃO' }])

  return j({})
}

/** Installs the SGA mock over globalThis.fetch. Returns a restore function. */
export function installSgaMock(sgaBaseUrl: string): () => void {
  const sgaBase = sgaBaseUrl.replace(/\/$/, '')
  const isSgaUrl = (href: string) =>
    href.startsWith(sgaBase) ||
    /\/(usuario\/autenticar|veiculo\/buscar|modelo\/listar|buscar\/(rateio-medio|situacao-financeira-veiculo)|listar\/(boleto|evento|boleto-associado)|cadastrar\/historico-atendimento|historico-atendimento-associado\/foto)/.test(
      href,
    )

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: any, init?: any) => {
    const href = String(url)
    if (isSgaUrl(href) && !href.includes('openai')) return sgaMock(href, init)
    return originalFetch(url, init)
  }) as typeof fetch

  return () => {
    globalThis.fetch = originalFetch
  }
}
