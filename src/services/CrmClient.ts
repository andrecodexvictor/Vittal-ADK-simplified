import { config } from '../core/config'

/**
 * CrmClient — mock-first integration with the AprovaAuto CRM.
 *
 * Mirrors the structural pattern of SgaClient (typed error, circuit breaker,
 * timeout, bearer auth, defensive field mapping). The contract lives in
 * agents/aprovauto-ai/whatsapp/spec/crm.openapi.json and is a PLACEHOLDER until
 * Lucas Cardozo shares the real CRM API doc (onboarding action item). When the
 * real doc arrives, only the request paths and field mappings below change.
 */
export class CrmIntegrationError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code = 'crm-integration-error',
  ) {
    super(message)
    this.name = 'CrmIntegrationError'
  }
}

export interface CrmContact {
  contactId?: string
  name?: string
  phone?: string
  cpf?: string
  isMember?: boolean
  openLeadId?: string
  tags: string[]
}

export interface CrmLead {
  leadId: string
  name?: string
  phone?: string
  stage: string
  createdAt?: string
  updatedAt?: string
}

export interface CrmInteraction {
  interactionId: string
  loggedAt?: string
}

type RequestOptions = {
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

class CrmCircuitBreaker {
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
    const windowStart = now - config.crmCircuitWindowMs
    this.failures = [...this.failures.filter((timestamp) => timestamp >= windowStart), now]

    if (this.failures.length >= config.crmCircuitFailureThreshold) {
      this.openedUntil = now + config.crmCircuitOpenMs
      this.failures = []
    }
  }
}

const circuitBreaker = new CrmCircuitBreaker()

/** Test/sim helper: resets module-level circuit breaker state between runs. */
export function __resetCrmState(): void {
  circuitBreaker.recordSuccess()
}

export class CrmClient {
  private readonly baseUrl: string

  constructor() {
    this.baseUrl = config.crmBaseUrl.replace(/\/$/, '')
  }

  async getContactByPhone(input: { phone?: string; cpf?: string }): Promise<CrmContact> {
    const data = await this.request<any>({
      method: 'GET',
      path: '/contacts/search',
      query: {
        phone: input.phone ? normalizeCrmPhone(input.phone) : undefined,
        cpf: input.cpf ? normalizeCrmCpf(input.cpf) : undefined,
      },
    })

    return {
      contactId: data.contactId ? String(data.contactId) : data.contact_id ? String(data.contact_id) : undefined,
      name: data.name ? String(data.name) : undefined,
      phone: data.phone ? String(data.phone) : input.phone,
      cpf: data.cpf ? String(data.cpf) : undefined,
      isMember: data.isMember ?? data.is_member,
      openLeadId: data.openLeadId ? String(data.openLeadId) : data.open_lead_id ? String(data.open_lead_id) : undefined,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    }
  }

  async upsertLead(input: {
    name: string
    phone: string
    plate?: string
    modelName?: string
    interest?: string
    quotedMonthlyAmount?: number
    source?: string
    stage?: string
  }): Promise<CrmLead> {
    const data = await this.request<any>({
      method: 'POST',
      path: '/leads',
      body: {
        name: input.name,
        phone: normalizeCrmPhone(input.phone),
        plate: input.plate,
        model_name: input.modelName,
        interest: input.interest,
        quoted_monthly_amount: input.quotedMonthlyAmount,
        source: input.source ?? 'whatsapp',
        stage: input.stage ?? 'qualifying',
      },
    })

    return {
      leadId: String(data.leadId ?? data.lead_id ?? data.id ?? ''),
      name: data.name ? String(data.name) : input.name,
      phone: data.phone ? String(data.phone) : normalizeCrmPhone(input.phone),
      stage: String(data.stage ?? input.stage ?? 'qualifying'),
      createdAt: data.createdAt ? String(data.createdAt) : data.created_at ? String(data.created_at) : undefined,
      updatedAt: data.updatedAt ? String(data.updatedAt) : data.updated_at ? String(data.updated_at) : undefined,
    }
  }

  async logInteraction(input: {
    phone: string
    summary: string
    leadId?: string
    channel?: string
    outcome?: string
  }): Promise<CrmInteraction> {
    const data = await this.request<any>({
      method: 'POST',
      path: '/interactions',
      body: {
        phone: normalizeCrmPhone(input.phone),
        lead_id: input.leadId,
        channel: input.channel ?? 'whatsapp',
        summary: input.summary,
        outcome: input.outcome,
      },
    })

    return {
      interactionId: String(data.interactionId ?? data.interaction_id ?? data.id ?? ''),
      loggedAt: data.loggedAt ? String(data.loggedAt) : data.logged_at ? String(data.logged_at) : undefined,
    }
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    if (!circuitBreaker.canRequest()) {
      throw new CrmIntegrationError('Circuit breaker aberto para CRM', undefined, 'crm-circuit-open')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.crmTimeoutMs)

    try {
      const url = this.buildUrl(options.path, options.query)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (config.crmBearerToken.trim()) {
        headers.Authorization = `Bearer ${config.crmBearerToken}`
      }

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
        throw new CrmIntegrationError(`CRM ${options.method} ${options.path} retornou ${response.status}: ${text}`, response.status)
      }

      circuitBreaker.recordSuccess()
      if (response.status === 204) return {} as T
      return (await response.json()) as T
    } catch (err) {
      if (err instanceof CrmIntegrationError) throw err
      circuitBreaker.recordFailure()
      const message = err instanceof Error ? err.message : String(err)
      throw new CrmIntegrationError(`Falha de conexão com CRM: ${message}`)
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

export function normalizeCrmPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function normalizeCrmCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}
