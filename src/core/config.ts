import { z } from 'zod'

const configSchema = z.object({
  // Webhook
  webhookSecret: z.string().min(1, 'WEBHOOK_SECRET is required'),

  // Vittal Hub
  hubBaseUrl: z.string().url().default('https://hub.vittalweb.com'),
  hubApiKey: z.string().optional(),
  hubAgentKey: z.string().min(1, 'HUB_AGENT_KEY is required'),

  // OpenAI
  openaiApiKey: z.string().min(1, 'OPENAI_API_KEY is required'),
  openaiModel: z.string().default('gpt-4o-mini'),
  openaiMaxTokens: z.coerce.number().default(1024),
  openaiTemperature: z.coerce.number().default(0.7),
  openaiTopP: z.coerce.number().default(1.0),
  openaiHistoryLimit: z.coerce.number().default(20),

  // RabbitMQ
  rabbitmqUrl: z.string().min(1, 'RABBITMQ_URL is required'),
  rabbitmqExchange: z.string().min(1, 'RABBITMQ_EXCHANGE is required'),
  rabbitmqRoutingKey: z.string().min(1, 'RABBITMQ_ROUTING_KEY is required'),

  // Outbound / UAZAPI
  outboundProvider: z.enum(['uazapi', 'crm']).default('uazapi'),
  outboundSource: z.string().optional(),
  uazapiUrl: z.string().url().default('https://flowcrm.uazapi.com'),
  uazapiToken: z.string().min(1, 'UAZAPI_TOKEN is required'),
  uazapiBaseUrl: z.string().default(''), // for direct media sending

  // SGA (Hinova v2) — two-step auth + operational codes
  sgaBaseUrl: z.string().url().default('https://api.hinova.com.br/api/sga/v2'),
  sgaApiToken: z.string().default(''), // static token: Authorization on /usuario/autenticar only
  sgaUsuario: z.string().default(''), // body of /usuario/autenticar
  sgaSenha: z.string().default(''),
  sgaTimeoutMs: z.coerce.number().default(10_000),
  sgaCircuitFailureThreshold: z.coerce.number().default(3),
  sgaCircuitWindowMs: z.coerce.number().default(60_000),
  sgaCircuitOpenMs: z.coerce.number().default(120_000),
  sgaMaxUploadBytes: z.coerce.number().default(10 * 1024 * 1024),
  // Test switch: intercept SGA traffic with the deterministic mock (no real ERP calls)
  sgaMock: z.preprocess((val) => val === 'true', z.boolean().default(false)),
  // Operational codes — valores reais descobertos via scripts/sga-discover.ts (jun/2026)
  sgaDefaultRegional: z.coerce.number().default(1), // regional 1 = APROVAUTO (ABB)
  sgaDefaultTipoVeiculo: z.string().default('1'),
  // Busca por nome de modelo: /modelo/listar não tem filtro server-side (8k+ modelos
  // em ~44 páginas), então paginamos e pontuamos por tokens. Limita o nº de páginas
  // varridas por cotação (early-exit no match forte mantém o caso comum barato).
  sgaModelSearchPageSize: z.coerce.number().default(200), // máx. permitido pela API
  sgaModelSearchMaxPages: z.coerce.number().default(50),
  sgaClaimStatusCode: z.coerce.number().default(3), // status-atendimento "EM ABERTO" = 3
  sgaClaimTypeCode: z.coerce.number().default(6), // tipo-atendimento "SINISTRO - ABERTURA" = 6
  sgaSinistroDeptCode: z.coerce.number().default(0), // departamento: rota não liberada no token ainda
  sgaBoletoOpenStatusCode: z.coerce.number().default(2), // situacao-boleto "ABERTO" = 2 (confirmado)
  // Mapa codigo_regional → unidade/equipe de transbordo (M2). JSON string; vazio = sem roteamento direcionado.
  sgaRegionalUnitMap: z.string().default(''),

  // Billing / cobrança ativa (régua)
  billingOverdueGraceDays: z.coerce.number().default(2), // D+1 manual settlement safety window
  billingMaxPages: z.coerce.number().default(20),
  billingPageSize: z.coerce.number().default(3000),
  billingDryRun: z.preprocess((val) => val !== 'false', z.boolean().default(true)),
  billingReminderGroup: z.string().default(''),

  // CRM (Optional) — mock-first until the real CRM API doc arrives
  crmMock: z.preprocess((val) => val === 'true', z.boolean().default(false)), // true = mock determinístico (sem CRM real)
  crmApiId: z.string().default(''),
  crmBearerToken: z.string().default(''),
  crmBaseUrl: z.string().url().default('https://crm.aprovauto.local'),
  crmTimeoutMs: z.coerce.number().default(10_000),
  crmCircuitFailureThreshold: z.coerce.number().default(3),
  crmCircuitWindowMs: z.coerce.number().default(60_000),
  crmCircuitOpenMs: z.coerce.number().default(120_000),

  // Feature Flags
  featureResponderGrupos: z.preprocess((val) => val === 'true', z.boolean().default(false)),
  featureFollowUp: z.preprocess((val) => val === 'true', z.boolean().default(false)),
  featureAcionarAtendente: z.preprocess((val) => val === 'true', z.boolean().default(true)),
  featureRag: z.preprocess((val) => val === 'true', z.boolean().default(false)),
  featureProcessarAudio: z.preprocess((val) => val === 'true', z.boolean().default(false)),
  featureProcessarImagem: z.preprocess((val) => val === 'true', z.boolean().default(false)),
  featureGroupNotifications: z.preprocess((val) => val === 'true', z.boolean().default(false)),
  featureCampanhas: z.preprocess((val) => val === 'true', z.boolean().default(false)),

  // Triggers & Whitelists
  triggerWord: z.string().default(''),
  whitelistNumbers: z.string().default(''),
  whitelistGroups: z.string().default(''),

  // Handoff & Follow-Up
  handoffAttendants: z.string().default(''),
  handoffAnnouncementGroup: z.string().default(''),
  agendamentoAnnouncementGroup: z.string().default(''),
  groupNotificationToken: z.string().default(''),
  followupDelayMs: z.coerce.number().default(3_600_000),

  // Campaigns
  campaignMinDelayMs: z.coerce.number().default(1000),
  campaignMaxDelayMs: z.coerce.number().default(3000),
  campaignBatchSize: z.coerce.number().default(10),
  campaignBatchDelayMs: z.coerce.number().default(60000),

  // App settings
  agentLevel: z.enum(['informational', 'transactional', 'orchestrator']).default('informational'),
  agentCapabilities: z.string().default('faq,lead_qualification,handoff'),
  debounceMs: z.coerce.number().default(3000),
  port: z.coerce.number().default(3000),
  logLevel: z.string().default('info'),
  logPretty: z.preprocess((val) => val === 'true', z.boolean().default(false)),
})

function loadConfig() {
  const raw = {
    webhookSecret: process.env.WEBHOOK_SECRET,
    hubBaseUrl: process.env.HUB_BASE_URL,
    hubApiKey: process.env.HUB_API_KEY,
    hubAgentKey: process.env.HUB_AGENT_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,
    openaiMaxTokens: process.env.OPENAI_MAX_TOKENS,
    openaiTemperature: process.env.OPENAI_TEMPERATURE,
    openaiTopP: process.env.OPENAI_TOP_P,
    openaiHistoryLimit: process.env.OPENAI_HISTORY_LIMIT,
    rabbitmqUrl: process.env.RABBITMQ_URL,
    rabbitmqExchange: process.env.RABBITMQ_EXCHANGE,
    rabbitmqRoutingKey: process.env.RABBITMQ_ROUTING_KEY,
    outboundProvider: process.env.OUTBOUND_PROVIDER,
    outboundSource: process.env.OUTBOUND_SOURCE,
    uazapiUrl: process.env.UAZAPI_URL,
    uazapiToken: process.env.UAZAPI_TOKEN,
    uazapiBaseUrl: process.env.UAZAPI_BASE_URL,
    sgaBaseUrl: process.env.SGA_BASE_URL,
    sgaApiToken: process.env.SGA_API_TOKEN,
    sgaUsuario: process.env.SGA_USUARIO,
    sgaSenha: process.env.SGA_SENHA,
    sgaTimeoutMs: process.env.SGA_TIMEOUT_MS,
    sgaCircuitFailureThreshold: process.env.SGA_CIRCUIT_FAILURE_THRESHOLD,
    sgaCircuitWindowMs: process.env.SGA_CIRCUIT_WINDOW_MS,
    sgaCircuitOpenMs: process.env.SGA_CIRCUIT_OPEN_MS,
    sgaMaxUploadBytes: process.env.SGA_MAX_UPLOAD_BYTES,
    sgaMock: process.env.SGA_MOCK,
    sgaDefaultRegional: process.env.SGA_DEFAULT_REGIONAL,
    sgaDefaultTipoVeiculo: process.env.SGA_DEFAULT_TIPO_VEICULO,
    sgaModelSearchPageSize: process.env.SGA_MODEL_SEARCH_PAGE_SIZE,
    sgaModelSearchMaxPages: process.env.SGA_MODEL_SEARCH_MAX_PAGES,
    sgaClaimStatusCode: process.env.SGA_CLAIM_STATUS_CODE,
    sgaClaimTypeCode: process.env.SGA_CLAIM_TYPE_CODE,
    sgaSinistroDeptCode: process.env.SGA_SINISTRO_DEPT_CODE,
    sgaBoletoOpenStatusCode: process.env.SGA_BOLETO_OPEN_STATUS_CODE,
    sgaRegionalUnitMap: process.env.SGA_REGIONAL_UNIT_MAP,
    billingOverdueGraceDays: process.env.BILLING_OVERDUE_GRACE_DAYS,
    billingMaxPages: process.env.BILLING_MAX_PAGES,
    billingPageSize: process.env.BILLING_PAGE_SIZE,
    billingDryRun: process.env.BILLING_DRY_RUN,
    billingReminderGroup: process.env.BILLING_REMINDER_GROUP,
    crmMock: process.env.CRM_MOCK,
    crmApiId: process.env.CRM_API_ID,
    crmBearerToken: process.env.CRM_BEARER_TOKEN,
    crmBaseUrl: process.env.CRM_BASE_URL,
    crmTimeoutMs: process.env.CRM_TIMEOUT_MS,
    crmCircuitFailureThreshold: process.env.CRM_CIRCUIT_FAILURE_THRESHOLD,
    crmCircuitWindowMs: process.env.CRM_CIRCUIT_WINDOW_MS,
    crmCircuitOpenMs: process.env.CRM_CIRCUIT_OPEN_MS,
    featureResponderGrupos: process.env.FEATURE_RESPONDER_GRUPOS,
    featureFollowUp: process.env.FEATURE_FOLLOW_UP,
    featureAcionarAtendente: process.env.FEATURE_ACIONAR_ATENDENTE,
    featureRag: process.env.FEATURE_RAG,
    featureProcessarAudio: process.env.FEATURE_PROCESSAR_AUDIO,
    featureProcessarImagem: process.env.FEATURE_PROCESSAR_IMAGEM,
    featureGroupNotifications: process.env.FEATURE_GROUP_NOTIFICATIONS,
    featureCampanhas: process.env.FEATURE_CAMPANHAS,
    triggerWord: process.env.TRIGGER_WORD,
    whitelistNumbers: process.env.WHITELIST_NUMBERS,
    whitelistGroups: process.env.WHITELIST_GROUPS,
    handoffAttendants: process.env.HANDOFF_ATTENDANTS,
    handoffAnnouncementGroup: process.env.HANDOFF_ANNOUNCEMENT_GROUP,
    agendamentoAnnouncementGroup: process.env.AGENDAMENTO_ANNOUNCEMENT_GROUP,
    groupNotificationToken: process.env.GROUP_NOTIFICATION_TOKEN,
    followupDelayMs: process.env.FOLLOWUP_DELAY_MS,
    campaignMinDelayMs: process.env.CAMPAIGN_MIN_DELAY_MS,
    campaignMaxDelayMs: process.env.CAMPAIGN_MAX_DELAY_MS,
    campaignBatchSize: process.env.CAMPAIGN_BATCH_SIZE,
    campaignBatchDelayMs: process.env.CAMPAIGN_BATCH_DELAY_MS,
    agentLevel: process.env.AGENT_LEVEL,
    agentCapabilities: process.env.AGENT_CAPABILITIES,
    debounceMs: process.env.DEBOUNCE_MS,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    logPretty: process.env.LOG_PRETTY,
  }

  const result = configSchema.safeParse(raw)

  if (!result.success) {
    if (process.env.NODE_ENV === 'test') {
      return {
        webhookSecret: 'test-secret',
        hubBaseUrl: 'https://hub.vittalweb.com',
        hubApiKey: 'test-key',
        hubAgentKey: 'test-agent-key',
        openaiApiKey: 'test-key',
        openaiModel: 'gpt-4o-mini',
        openaiMaxTokens: 1024,
        openaiTemperature: 0.7,
        openaiTopP: 1.0,
        openaiHistoryLimit: 20,
        rabbitmqUrl: 'amqp://localhost',
        rabbitmqExchange: 'test-exchange',
        rabbitmqRoutingKey: 'test-key',
        outboundProvider: 'uazapi' as const,
        outboundSource: 'test-source',
        uazapiUrl: 'https://flowcrm.uazapi.com',
        uazapiToken: 'test-uazapi-token',
        uazapiBaseUrl: '',
        sgaBaseUrl: 'https://sga.test.local',
        sgaApiToken: 'test-sga-token',
        sgaUsuario: 'test-user',
        sgaSenha: 'test-pass',
        sgaTimeoutMs: 10000,
        sgaCircuitFailureThreshold: 3,
        sgaCircuitWindowMs: 60000,
        sgaCircuitOpenMs: 120000,
        sgaMaxUploadBytes: 10 * 1024 * 1024,
        sgaMock: true,
        sgaDefaultRegional: 9,
        sgaDefaultTipoVeiculo: '1',
        sgaClaimStatusCode: 10,
        sgaClaimTypeCode: 20,
        sgaSinistroDeptCode: 30,
        sgaBoletoOpenStatusCode: 2,
        sgaRegionalUnitMap: '',
        billingOverdueGraceDays: 2,
        billingMaxPages: 20,
        billingPageSize: 3000,
        billingDryRun: true,
        billingReminderGroup: '',
        crmMock: true,
        crmApiId: '',
        crmBearerToken: '',
        crmBaseUrl: 'https://crm.test.local',
        crmTimeoutMs: 10000,
        crmCircuitFailureThreshold: 3,
        crmCircuitWindowMs: 60000,
        crmCircuitOpenMs: 120000,
        featureResponderGrupos: false,
        featureFollowUp: false,
        featureAcionarAtendente: true,
        featureRag: false,
        featureProcessarAudio: false,
        featureProcessarImagem: false,
        featureGroupNotifications: false,
        featureCampanhas: false,
        triggerWord: '',
        whitelistNumbers: '',
        whitelistGroups: '',
        handoffAttendants: '',
        handoffAnnouncementGroup: '',
        agendamentoAnnouncementGroup: '',
        groupNotificationToken: '',
        followupDelayMs: 3600000,
        campaignMinDelayMs: 1000,
        campaignMaxDelayMs: 3000,
        campaignBatchSize: 10,
        campaignBatchDelayMs: 60000,
        agentLevel: 'informational' as const,
        agentCapabilities: 'faq,lead_qualification,handoff',
        debounceMs: 3000,
        port: 3000,
        logLevel: 'info',
        logPretty: false,
      }
    }
    const errors = result.error.issues.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n')
    throw new Error(`Invalid configuration for active agent:\n${errors}`)
  }

  return result.data
}

export type AppConfig = ReturnType<typeof loadConfig>
export const config = loadConfig()
