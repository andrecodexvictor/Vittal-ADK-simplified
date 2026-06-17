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

  // CRM (Optional)
  crmApiId: z.string().default(''),
  crmBearerToken: z.string().default(''),

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
    crmApiId: process.env.CRM_API_ID,
    crmBearerToken: process.env.CRM_BEARER_TOKEN,
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
        crmApiId: '',
        crmBearerToken: '',
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
      }
    }
    const errors = result.error.issues.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n')
    throw new Error(`Invalid configuration for active agent:\n${errors}`)
  }

  return result.data
}

export type AppConfig = ReturnType<typeof loadConfig>
export const config = loadConfig()
