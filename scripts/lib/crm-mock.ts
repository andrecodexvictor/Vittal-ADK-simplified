/**
 * Deterministic CRM mock — espelha scripts/lib/sga-mock.ts.
 *
 * O CRM real da AprovaAuto ainda não tem doc/contrato (ação do Lucas no onboarding).
 * Até lá, com CRM_MOCK=true este mock intercepta globalThis.fetch para os endpoints
 * do CrmClient (/contacts/search, /leads, /interactions) e devolve respostas
 * determinísticas, deixando todo o resto (SGA real, OpenAI) passar direto.
 *
 * Shapes espelham o contrato placeholder em spec/crm.openapi.json. Quando a doc
 * real chegar, troca-se CRM_MOCK=false + CRM_BASE_URL/CRM_BEARER_TOKEN reais.
 */
const j = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

export function crmMock(href: string, init?: RequestInit): Response {
  let body: any = {}
  try {
    body = init?.body ? JSON.parse(String(init.body)) : {}
  } catch {}

  if (href.includes('/contacts/search')) {
    const url = new URL(href)
    const phone = url.searchParams.get('phone') ?? ''
    // Telefone "conhecido" devolve associado com oportunidade aberta; o resto, contato novo.
    if (phone.endsWith('5690')) {
      return j({
        contact_id: 'crm-1001',
        name: 'CARLOS EDUARDO SILVA',
        phone,
        is_member: true,
        open_lead_id: 'lead-2001',
        tags: ['associado', 'sinistro_anterior'],
      })
    }
    return j({ contact_id: null, phone, is_member: false, tags: [] })
  }

  if (href.includes('/leads')) {
    return j({
      lead_id: `lead-${Math.abs(hashString(String(body?.phone ?? 'novo'))) % 9000 + 1000}`,
      name: body?.name ?? 'Lead',
      phone: body?.phone ?? '',
      stage: body?.stage ?? 'qualifying',
      created_at: '2026-06-23T12:00:00.000Z',
      updated_at: '2026-06-23T12:00:00.000Z',
    })
  }

  if (href.includes('/interactions')) {
    return j({ interaction_id: `int-${Math.abs(hashString(String(body?.summary ?? ''))) % 90000 + 10000}`, logged_at: '2026-06-23T12:00:00.000Z' })
  }

  return j({})
}

/** Deterministic id helper (sem Date.now/Math.random para reprodutibilidade). */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

/** Installs the CRM mock over globalThis.fetch. Returns a restore function. */
export function installCrmMock(crmBaseUrl: string): () => void {
  const crmBase = crmBaseUrl.replace(/\/$/, '')
  const isCrmUrl = (href: string) =>
    href.startsWith(crmBase) || /\/(contacts\/search|leads|interactions)(\b|\/|\?)/.test(href)

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: any, init?: any) => {
    const href = String(url)
    if (isCrmUrl(href) && !href.includes('openai') && !href.includes('hinova')) return crmMock(href, init)
    return originalFetch(url, init)
  }) as typeof fetch

  return () => {
    globalThis.fetch = originalFetch
  }
}
