import { config } from '../core/config'

/**
 * SgaClient — integração real com a API Hinova SGA v2.
 *
 * Autenticação two-step: POST /usuario/autenticar (Bearer estático SGA_API_TOKEN +
 * body usuario/senha) retorna token_usuario (não expira), cacheado em nível de
 * módulo e usado como Bearer nas demais chamadas. Endpoints conforme
 * spec/sga.openapi.json e doc oficial https://api.hinova.com.br/api/sga/v2/doc/.
 *
 * Datas de entrada: dd/mm/yyyy. Valores monetários vêm como String (vírgula ou
 * ponto) — normalizados aqui. A API NÃO expõe PIX: pagamento é por boleto
 * (link_boleto) e linha digitável.
 */
export class SgaIntegrationError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code = 'sga-integration-error',
  ) {
    super(message)
    this.name = 'SgaIntegrationError'
  }
}

export interface SgaVehicle {
  plate?: string
  modelName: string
  brand?: string
  year?: number
  fipeValue: number
  codigoRegional?: number
  codigoTipoVeiculo?: string
  hasActiveContract?: boolean
}

export interface SgaQuote {
  monthlyAmount: number
  vehicleValue: number
  coverages: string[]
  hasTracker: boolean
  quoteId?: string
}

export interface SgaInvoice {
  invoiceId: string // nosso_numero
  dueDate: string
  amount: number
  status: string
  boletoPdfUrl?: string // link_boleto
  barcode?: string // linha_digitavel
  pixCopyPaste?: string // only when the SGA response includes a Pix field
  contractPlate?: string
  daysOverdue?: number
}

export interface SgaBoletoListItem extends SgaInvoice {
  associadoCode?: string
  associadoName?: string
  cpf?: string
  phone?: string
  email?: string
}

export interface SgaClaim {
  claimId: string
  protocol: string
  status: string
}

export interface SgaClaimStatus {
  claimId: string
  status: string
  description?: string
  updatedAt?: string
}

export interface SgaProductGroup {
  code: string
  description: string
  situacao?: string
}

export interface SgaRegional {
  code: string
  name: string
  tradeName?: string
  city?: string
  state?: string
  situacao?: string
}

export interface SgaFinancialStatus {
  cpf?: string
  name?: string
  plate?: string
  vehicleCode?: string
  modelName?: string
  isDelinquent: boolean
  rawStatus: string
}

type RequestOptions = {
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  skipAuth?: boolean // true only for /usuario/autenticar
}

class SgaCircuitBreaker {
  private failures: number[] = []
  private openedUntil = 0

  canRequest(now = Date.now()): boolean {
    return now >= this.openedUntil
  }

  recordSuccess(): void {
    this.failures = []
    this.openedUntil = 0
  }

  recordFailure(now = Date.now()): void {
    const windowStart = now - config.sgaCircuitWindowMs
    this.failures = [...this.failures.filter((timestamp) => timestamp >= windowStart), now]

    if (this.failures.length >= config.sgaCircuitFailureThreshold) {
      this.openedUntil = now + config.sgaCircuitOpenMs
      this.failures = []
    }
  }
}

const circuitBreaker = new SgaCircuitBreaker()
let cachedToken: string | null = null
let authPromise: Promise<string> | null = null

/** Test/sim helper: resets cached token + circuit breaker between runs. */
export function __resetSgaState(): void {
  cachedToken = null
  authPromise = null
  circuitBreaker.recordSuccess()
}

export class SgaClient {
  private readonly baseUrl: string

  constructor() {
    this.baseUrl = config.sgaBaseUrl.replace(/\/$/, '')
  }

  async searchVehicle(input: { plate?: string; modelName?: string }): Promise<SgaVehicle> {
    if (input.plate?.trim()) {
      const plate = normalizePlate(input.plate)
      const data = await this.request<any>({
        method: 'GET',
        path: `/veiculo/buscar-por-permissao/${encodeURIComponent(plate)}/`,
      })
      const vehicle = Array.isArray(data) ? data[0] : data
      if (!vehicle) throw new SgaIntegrationError('Veículo não encontrado', 406, 'sga-vehicle-not-found')
      return mapVehicle(vehicle, plate)
    }

    // Search by model name → /modelo/listar then map the best match
    const models = await this.request<any>({
      method: 'POST',
      path: '/modelo/listar',
      body: { situacao: 'ativo', inicio_paginacao: 0, quantidade_por_pagina: 50 },
    })
    const list: any[] = Array.isArray(models) ? models : models.modelos ?? []
    const wanted = (input.modelName ?? '').toLowerCase()
    const match =
      list.find((m) => `${m.descricao_modelo ?? ''}`.toLowerCase().includes(wanted)) ?? list[0]
    if (!match) throw new SgaIntegrationError('Modelo não encontrado', 406, 'sga-model-not-found')
    return {
      modelName: String(match.descricao_modelo ?? input.modelName ?? ''),
      brand: match.descricao_marca ? String(match.descricao_marca) : undefined,
      fipeValue: 0, // model search has no FIPE; agent must confirm value or use plate
      codigoTipoVeiculo: match.codigo_tipo_veiculo ? String(match.codigo_tipo_veiculo) : config.sgaDefaultTipoVeiculo,
    }
  }

  async simulateQuote(input: {
    vehicleValue: number
    hasTracker: boolean
    coverages: string[]
    codigoRegional?: number
    codigoTipoVeiculo?: string
  }): Promise<SgaQuote> {
    const data = await this.request<any>({
      method: 'POST',
      path: '/buscar/rateio-medio',
      body: {
        valor_fipe: input.vehicleValue,
        codigo_regional: input.codigoRegional ?? config.sgaDefaultRegional,
        codigo_tipo_veiculo: input.codigoTipoVeiculo ?? config.sgaDefaultTipoVeiculo,
        quantidade_meses_media: 3,
      },
    })

    return {
      monthlyAmount: normalizeMoney(data.valor_rateio_medio ?? data.valor ?? 0),
      vehicleValue: input.vehicleValue,
      coverages: input.coverages,
      hasTracker: input.hasTracker,
    }
  }

  async getFinancialInvoice(input: { cpf: string; plate: string }): Promise<{ invoices: SgaInvoice[] }> {
    const data = await this.request<any>({
      method: 'POST',
      path: '/listar/boleto/periodo',
      body: {
        cpf_associado: normalizeCpf(input.cpf),
        codigo_situacao_boleto: config.sgaBoletoOpenStatusCode,
      },
    })

    const plate = normalizePlate(input.plate)
    const rawInvoices: any[] = Array.isArray(data) ? data : data.boletos ?? data.invoices ?? []
    return { invoices: rawInvoices.map((invoice) => mapInvoice(invoice, plate)) }
  }

  /** Mass listing of boletos in a due-date window (paginated) — used by the active billing runner. */
  async listBoletosByPeriod(input: {
    dueDateStart: string // dd/mm/yyyy
    dueDateEnd: string // dd/mm/yyyy
    situationCode?: number
    pageSize?: number
    pageStart?: number
  }): Promise<SgaBoletoListItem[]> {
    const data = await this.request<any>({
      method: 'POST',
      path: '/listar/boleto-associado/periodo',
      body: {
        data_vencimento_inicial: input.dueDateStart,
        data_vencimento_final: input.dueDateEnd,
        codigo_situacao_boleto: input.situationCode ?? config.sgaBoletoOpenStatusCode,
        quantidade_por_pagina: input.pageSize ?? config.billingPageSize,
        inicio_paginacao: input.pageStart ?? 0,
      },
    })

    const rawInvoices: any[] = Array.isArray(data) ? data : data.boletos ?? []
    return rawInvoices.map((invoice) => ({
      ...mapInvoice(invoice),
      associadoCode: invoice.codigo_associado != null ? String(invoice.codigo_associado) : undefined,
      associadoName: invoice.nome_associado ? String(invoice.nome_associado) : undefined,
      cpf: invoice.cpf ? normalizeCpf(String(invoice.cpf)) : undefined,
      phone: invoice.celular ? String(invoice.celular).replace(/\D/g, '') : undefined,
      email: invoice.email ? String(invoice.email) : undefined,
    }))
  }

  async getFinancialStatusByPlate(plate: string): Promise<SgaFinancialStatus> {
    const data = await this.request<any>({
      method: 'GET',
      path: `/buscar/situacao-financeira-veiculo/${encodeURIComponent(normalizePlate(plate))}`,
    })

    const rawStatus = String(data.situacao_financeira ?? data.descricao_situacao_financeira ?? '')
    return {
      cpf: data.cpf ? String(data.cpf) : undefined,
      name: data.nome ? String(data.nome) : undefined,
      plate: data.placa ? String(data.placa) : plate,
      vehicleCode: data.codigo_veiculo ? String(data.codigo_veiculo) : undefined,
      modelName: data.descricao_modelo ? String(data.descricao_modelo) : undefined,
      isDelinquent: rawStatus.toUpperCase().includes('INADIMPLENTE'),
      rawStatus,
    }
  }

  async createClaim(input: {
    cpf: string
    plate: string
    dateTime: string
    location: string
    description: string
    hasThirdParty: boolean
    thirdPartyData?: Record<string, unknown>
  }): Promise<SgaClaim> {
    const thirdParty = input.hasThirdParty
      ? `\nTerceiros: ${JSON.stringify(input.thirdPartyData ?? {})}`
      : '\nSem terceiros envolvidos.'
    const descricao = `Data/hora: ${input.dateTime}\nLocal: ${input.location}\nRelato: ${input.description}${thirdParty}`

    const data = await this.request<any>({
      method: 'POST',
      path: '/cadastrar/historico-atendimento-associado',
      body: {
        cpf: normalizeCpf(input.cpf),
        codigo_status_atendimento: config.sgaClaimStatusCode,
        codigo_tipo_atendimento: config.sgaClaimTypeCode,
        codigo_departamento: config.sgaSinistroDeptCode,
        titulo: `Sinistro - ${normalizePlate(input.plate)}`,
        descricao,
        placa: normalizePlate(input.plate),
      },
    })

    const claimId = String(data.codigo_historico_atendimento ?? data.claimId ?? data.id ?? '')
    return {
      claimId,
      protocol: String(data.protocolo ?? claimId),
      status: String(data.mensagem ?? data.status ?? 'created'),
    }
  }

  async uploadClaimDocument(input: {
    claimId: string
    docType: string
    base64?: string
    link?: string
    filename: string
  }): Promise<{ uploaded: boolean; documentId?: string }> {
    const foto: Record<string, unknown> = { nome_arquivo: input.filename }
    if (input.link) foto.link = input.link
    if (input.base64) foto.binario = input.base64

    const data = await this.request<any>({
      method: 'POST',
      path: '/historico-atendimento-associado/foto/cadastrar',
      body: {
        codigo_atendimento: Number(input.claimId) || input.claimId,
        foto: [foto],
      },
    })

    const result = Array.isArray(data) ? data[0] : data
    const uploaded = String(result?.situacao ?? '').toLowerCase().includes('inserido')
    return { uploaded, documentId: result?.nome_arquivo ? String(result.nome_arquivo) : undefined }
  }

  async getClaimStatus(input: { claimId?: string; plate?: string }): Promise<SgaClaimStatus> {
    if (input.plate?.trim()) {
      const data = await this.request<any>({
        method: 'GET',
        path: `/listar/evento-veiculo/${encodeURIComponent(normalizePlate(input.plate))}`,
      })
      const eventos: any[] = data.eventos ?? (Array.isArray(data) ? data : [])
      const evento = eventos[0]
      if (!evento) throw new SgaIntegrationError('Nenhum evento encontrado para a placa', 406, 'sga-event-not-found')
      return mapEvento(evento)
    }

    const data = await this.request<any>({
      method: 'POST',
      path: '/listar/evento',
      body: { protocolo: input.claimId },
    })
    const evento = Array.isArray(data) ? data[0] : data
    if (!evento) throw new SgaIntegrationError('Evento não encontrado', 406, 'sga-event-not-found')
    return mapEvento(evento)
  }

  // ── Grupos opcionais (Fase 3) — paths confirmados via sga-discover.ts ──

  /** Catálogo de grupos de produto (planos/coberturas) — GET /listar/grupo-produto/todos. */
  async listProductGroups(): Promise<SgaProductGroup[]> {
    const data = await this.request<any>({ method: 'GET', path: '/listar/grupo-produto/todos' })
    const list: any[] = Array.isArray(data) ? data : (data.grupos ?? data.produtos ?? [])
    return list.map((g) => ({
      code: String(g.codigo_grupo_produto ?? g.codigo_grupoproduto ?? g.codigo ?? ''),
      description: String(g.descricao ?? g.nome ?? ''),
      situacao: g.situacao ? String(g.situacao) : undefined,
    }))
  }

  /** Lista as regionais (codigo_regional → unidade) — GET /listar/regional/todos. */
  async listRegionais(): Promise<SgaRegional[]> {
    const data = await this.request<any>({ method: 'GET', path: '/listar/regional/todos' })
    const list: any[] = Array.isArray(data) ? data : (data.regionais ?? [])
    return list.map((r) => ({
      code: String(r.codigo_regional ?? ''),
      name: String(r.nome ?? ''),
      tradeName: r.nome_fantasia ? String(r.nome_fantasia) : undefined,
      city: r.cidade ? String(r.cidade) : undefined,
      state: r.estado ? String(r.estado) : undefined,
      situacao: r.situacao ? String(r.situacao) : undefined,
    }))
  }

  /** Tipos de vistoria — GET /listar/tipo-vistoria/todos. */
  async listInspectionTypes(): Promise<Array<{ code: string; description: string }>> {
    const data = await this.request<any>({ method: 'GET', path: '/listar/tipo-vistoria/todos' })
    const list: any[] = Array.isArray(data) ? data : (data.tipos ?? [])
    return list.map((t) => ({
      code: String(t.codigo_tipovistoria ?? t.codigo_tipo_vistoria ?? t.codigo ?? ''),
      description: String(t.descricao ?? ''),
    }))
  }

  /** Vistorias num intervalo (dd/mm/yyyy) — POST /listar/vistoria. */
  async listInspectionsByPeriod(input: { startDate: string; endDate: string }): Promise<any[]> {
    const data = await this.request<any>({
      method: 'POST',
      path: '/listar/vistoria',
      body: {
        data_vistoria_inicial: input.startDate,
        data_vistoria_final: input.endDate,
        inicio_paginacao: 0,
        quantidade_por_pagina: 50,
      },
    })
    return Array.isArray(data) ? data : (data.vistorias ?? [])
  }

  /**
   * Thin public escape hatch for the discovery script (scripts/sga-discover.ts):
   * authenticates (two-step) and issues a raw call to any endpoint not yet wrapped
   * by a dedicated method. Returns the parsed JSON as-is. Not used in runtime flows.
   */
  async requestRaw<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    query?: RequestOptions['query'],
  ): Promise<T> {
    return this.request<T>({ method, path, body, query })
  }

  // ── Auth + low-level request ──

  private async authenticate(): Promise<string> {
    if (cachedToken) return cachedToken
    if (authPromise) return authPromise

    authPromise = (async () => {
      const data = await this.request<any>({
        method: 'POST',
        path: '/usuario/autenticar',
        skipAuth: true,
        body: { usuario: config.sgaUsuario, senha: config.sgaSenha },
      })
      const token = String(data.token_usuario ?? data.token ?? '')
      if (!token) throw new SgaIntegrationError('Autenticação SGA não retornou token_usuario', undefined, 'sga-auth-failed')
      cachedToken = token
      return token
    })()

    try {
      return await authPromise
    } finally {
      authPromise = null
    }
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    if (!circuitBreaker.canRequest()) {
      throw new SgaIntegrationError('Circuit breaker aberto para SGA', undefined, 'sga-circuit-open')
    }

    const token = options.skipAuth ? config.sgaApiToken : await this.authenticate()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.sgaTimeoutMs)

    try {
      const url = this.buildUrl(options.path, options.query)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token.trim()) headers.Authorization = `Bearer ${token}`

      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        if (response.status >= 500 || response.status === 408 || response.status === 429) {
          circuitBreaker.recordFailure()
        }
        // A stale token can cause 401/403 — drop it so the next call re-authenticates.
        if ((response.status === 401 || response.status === 403) && !options.skipAuth) {
          cachedToken = null
        }
        throw new SgaIntegrationError(`SGA ${options.method} ${options.path} retornou ${response.status}: ${text}`, response.status)
      }

      circuitBreaker.recordSuccess()
      if (response.status === 204) return {} as T
      return (await response.json()) as T
    } catch (err) {
      if (err instanceof SgaIntegrationError) throw err
      circuitBreaker.recordFailure()
      const message = err instanceof Error ? err.message : String(err)
      throw new SgaIntegrationError(`Falha de conexão com SGA: ${message}`)
    } finally {
      clearTimeout(timeout)
    }
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }
}

// ── Mappers + normalizers ──

function mapVehicle(data: any, fallbackPlate?: string): SgaVehicle {
  return {
    plate: data.placa ? normalizePlate(String(data.placa)) : fallbackPlate,
    modelName: String(data.modelo ?? data.descricao_modelo ?? data.modelName ?? ''),
    brand: data.marca ? String(data.marca) : undefined,
    year: data.ano_modelo ? Number(data.ano_modelo) : data.ano_fabricacao ? Number(data.ano_fabricacao) : undefined,
    fipeValue: normalizeMoney(data.valor_fipe ?? data.valor_fixo ?? 0),
    codigoRegional: data.codigo_regional ? Number(data.codigo_regional) : undefined,
    codigoTipoVeiculo: data.codigo_tipo_veiculo ? String(data.codigo_tipo_veiculo) : undefined,
    hasActiveContract: data.descricao_situacao
      ? String(data.descricao_situacao).toUpperCase().includes('ATIVO')
      : undefined,
  }
}

function mapInvoice(invoice: any, wantedPlate?: string): SgaInvoice {
  const veiculos: any[] = Array.isArray(invoice.veiculos) ? invoice.veiculos : []
  const plates = veiculos.map((v) => (v.placa ? normalizePlate(String(v.placa)) : '')).filter(Boolean)
  const contractPlate = wantedPlate && plates.includes(wantedPlate) ? wantedPlate : plates[0]

  return {
    invoiceId: String(invoice.nosso_numero ?? invoice.invoiceId ?? invoice.id ?? ''),
    dueDate: String(invoice.data_vencimento ?? invoice.dueDate ?? ''),
    amount: normalizeMoney(invoice.valor_boleto_multa_mora ?? invoice.valor_boleto ?? invoice.amount ?? 0),
    status: String(invoice.situacao_boleto ?? invoice.descricao_situacao_boleto ?? invoice.status ?? 'open'),
    boletoPdfUrl: invoice.link_boleto ?? invoice.boletoPdfUrl ?? undefined,
    barcode: invoice.linha_digitavel ?? invoice.barcode ?? undefined,
    pixCopyPaste: invoice.pix?.copia_cola ?? invoice.pix_copia_cola ?? invoice.pixCopyPaste ?? undefined,
    contractPlate,
    daysOverdue: invoice.quantidade_dias_vencidos != null ? Number(invoice.quantidade_dias_vencidos) : undefined,
  }
}

function mapEvento(evento: any): SgaClaimStatus {
  return {
    claimId: String(evento.protocolo ?? evento.codigo_evento ?? ''),
    status: String(evento.situacao_evento ?? evento.status ?? ''),
    description: evento.descricao_motivo ? String(evento.descricao_motivo) : undefined,
    updatedAt: evento.data_evento ? String(evento.data_evento) : undefined,
  }
}

export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

export function normalizePlate(plate: string): string {
  return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

/** Parses Hinova money strings ("R$ 189,50", "1.234,56", "145.00", 145) into a number. */
export function normalizeMoney(value: unknown): number {
  if (typeof value === 'number') return value
  let s = String(value ?? '').replace(/[^\d.,-]/g, '')
  if (!s) return 0
  if (s.includes(',')) {
    // Brazilian format: dots are thousand separators, comma is decimal
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
