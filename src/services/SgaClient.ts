import { config } from '../core/config'

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
  invoiceId: string
  dueDate: string
  amount: number
  status: string
  boletoPdfUrl?: string
  barcode?: string
  pixCopyPaste?: string
  contractPlate?: string
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

type RequestOptions = {
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  formData?: FormData
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

export class SgaClient {
  private readonly baseUrl: string

  constructor() {
    this.baseUrl = config.sgaBaseUrl.replace(/\/$/, '')
  }

  async searchVehicle(input: { plate?: string; modelName?: string }): Promise<SgaVehicle> {
    const data = await this.request<any>({
      method: 'GET',
      path: '/vehicles/search',
      query: {
        plate: input.plate ? normalizePlate(input.plate) : undefined,
        modelName: input.modelName,
      },
    })

    return {
      plate: data.plate ? normalizePlate(String(data.plate)) : input.plate,
      modelName: String(data.modelName ?? data.model_name ?? data.name ?? ''),
      brand: data.brand ? String(data.brand) : undefined,
      year: data.year ? Number(data.year) : undefined,
      fipeValue: Number(data.fipeValue ?? data.fipe_value ?? data.vehicleValue ?? 0),
      hasActiveContract: data.hasActiveContract ?? data.has_active_contract,
    }
  }

  async simulateQuote(input: {
    vehicleValue: number
    hasTracker: boolean
    coverages: string[]
  }): Promise<SgaQuote> {
    const data = await this.request<any>({
      method: 'POST',
      path: '/quotes/simulate',
      body: {
        vehicle_value: input.vehicleValue,
        has_tracker: input.hasTracker,
        coverages: input.coverages,
      },
    })

    return {
      monthlyAmount: Number(data.monthlyAmount ?? data.monthly_amount ?? data.amount ?? 0),
      vehicleValue: Number(data.vehicleValue ?? data.vehicle_value ?? input.vehicleValue),
      coverages: Array.isArray(data.coverages) ? data.coverages.map(String) : input.coverages,
      hasTracker: Boolean(data.hasTracker ?? data.has_tracker ?? input.hasTracker),
      quoteId: data.quoteId ? String(data.quoteId) : data.quote_id ? String(data.quote_id) : undefined,
    }
  }

  async getFinancialInvoice(input: { cpf: string; plate: string }): Promise<{ invoices: SgaInvoice[] }> {
    const data = await this.request<any>({
      method: 'GET',
      path: '/financial/invoices',
      query: {
        cpf: normalizeCpf(input.cpf),
        plate: normalizePlate(input.plate),
      },
    })

    const rawInvoices = Array.isArray(data) ? data : data.invoices ?? data.items ?? []
    return {
      invoices: rawInvoices.map((invoice: any) => ({
        invoiceId: String(invoice.invoiceId ?? invoice.invoice_id ?? invoice.id ?? ''),
        dueDate: String(invoice.dueDate ?? invoice.due_date ?? invoice.vencimento ?? ''),
        amount: Number(invoice.amount ?? invoice.valor ?? 0),
        status: String(invoice.status ?? 'open'),
        boletoPdfUrl: invoice.boletoPdfUrl ?? invoice.boleto_pdf_url ?? invoice.pdf_url,
        barcode: invoice.barcode ?? invoice.linha_digitavel,
        pixCopyPaste: invoice.pixCopyPaste ?? invoice.pix_copy_paste ?? invoice.pix,
        contractPlate: invoice.contractPlate
          ? normalizePlate(String(invoice.contractPlate))
          : invoice.contract_plate
            ? normalizePlate(String(invoice.contract_plate))
            : undefined,
      })),
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
    const data = await this.request<any>({
      method: 'POST',
      path: '/claims',
      body: {
        cpf: normalizeCpf(input.cpf),
        plate: normalizePlate(input.plate),
        date_time: input.dateTime,
        location: input.location,
        description: input.description,
        has_third_party: input.hasThirdParty,
        third_party_data: input.thirdPartyData ?? null,
      },
    })

    return {
      claimId: String(data.claimId ?? data.claim_id ?? data.id ?? ''),
      protocol: String(data.protocol ?? data.protocolo ?? data.claimId ?? data.claim_id ?? ''),
      status: String(data.status ?? 'created'),
    }
  }

  async uploadClaimDocument(input: {
    claimId: string
    docType: string
    file: Blob
    filename: string
    mimeType: string
  }): Promise<{ uploaded: true; documentId?: string }> {
    const formData = new FormData()
    formData.set('claim_id', input.claimId)
    formData.set('doc_type', input.docType)
    formData.set('file', input.file, input.filename)

    const data = await this.request<any>({
      method: 'POST',
      path: `/claims/${encodeURIComponent(input.claimId)}/documents`,
      formData,
    })

    return {
      uploaded: true,
      documentId: data.documentId ? String(data.documentId) : data.document_id ? String(data.document_id) : undefined,
    }
  }

  async getClaimStatus(input: { claimId?: string; cpf?: string }): Promise<SgaClaimStatus> {
    const data = await this.request<any>({
      method: 'GET',
      path: '/claims/status',
      query: {
        claimId: input.claimId,
        cpf: input.cpf ? normalizeCpf(input.cpf) : undefined,
      },
    })

    return {
      claimId: String(data.claimId ?? data.claim_id ?? input.claimId ?? ''),
      status: String(data.status ?? ''),
      description: data.description ? String(data.description) : data.descricao ? String(data.descricao) : undefined,
      updatedAt: data.updatedAt ? String(data.updatedAt) : data.updated_at ? String(data.updated_at) : undefined,
    }
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    if (!circuitBreaker.canRequest()) {
      throw new SgaIntegrationError('Circuit breaker aberto para SGA', undefined, 'sga-circuit-open')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.sgaTimeoutMs)

    try {
      const url = this.buildUrl(options.path, options.query)
      const headers: Record<string, string> = {}
      if (config.sgaApiToken.trim()) {
        headers.Authorization = `Bearer ${config.sgaApiToken}`
      }
      if (!options.formData) {
        headers['Content-Type'] = 'application/json'
      }

      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined),
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        if (response.status >= 500 || response.status === 408 || response.status === 429) {
          circuitBreaker.recordFailure()
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

export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

export function normalizePlate(plate: string): string {
  return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}
