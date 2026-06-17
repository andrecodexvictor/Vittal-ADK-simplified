import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export const AGENT_LEVELS = ['informational', 'transactional', 'orchestrator'] as const
export type AgentLevel = (typeof AGENT_LEVELS)[number]

export const AGENT_CAPABILITIES = [
  'faq',
  'rag',
  'lead_qualification',
  'group_notification',
  'handoff',
  'info_followup',
  'appointment_lookup',
  'appointment_create',
  'appointment_reschedule',
  'appointment_cancel',
  'payment_create',
  'crm_update',
  'human_approval',
  'multi_system_orchestration',
] as const
export type AgentCapability = (typeof AGENT_CAPABILITIES)[number]

const AGENT_LEVEL_ORDER: Record<AgentLevel, number> = {
  informational: 1,
  transactional: 2,
  orchestrator: 3,
}

export const AGENT_CAPABILITY_MIN_LEVEL: Record<AgentCapability, AgentLevel> = {
  faq: 'informational',
  rag: 'informational',
  lead_qualification: 'informational',
  group_notification: 'informational',
  handoff: 'informational',
  info_followup: 'informational',
  appointment_lookup: 'transactional',
  appointment_create: 'transactional',
  appointment_reschedule: 'transactional',
  appointment_cancel: 'transactional',
  payment_create: 'transactional',
  crm_update: 'transactional',
  human_approval: 'orchestrator',
  multi_system_orchestration: 'orchestrator',
}

export interface AgentCapabilityLevelViolation {
  capability: AgentCapability
  currentLevel: AgentLevel
  requiredLevel: AgentLevel
}

export function isAgentLevelAtLeast(currentLevel: AgentLevel, requiredLevel: AgentLevel): boolean {
  return AGENT_LEVEL_ORDER[currentLevel] >= AGENT_LEVEL_ORDER[requiredLevel]
}

export function getCapabilityRequiredLevel(capability: AgentCapability): AgentLevel {
  return AGENT_CAPABILITY_MIN_LEVEL[capability]
}

export function getCapabilityLevelViolations(
  level: AgentLevel,
  capabilities: AgentCapability[],
): AgentCapabilityLevelViolation[] {
  return capabilities.flatMap((capability) => {
    const requiredLevel = getCapabilityRequiredLevel(capability)
    if (isAgentLevelAtLeast(level, requiredLevel)) {
      return []
    }
    return [{ capability, currentLevel: level, requiredLevel }]
  })
}

export function formatCapabilityLevelViolations(
  violations: AgentCapabilityLevelViolation[],
): string {
  return violations
    .map((v) => `${v.capability} exige nível ${v.requiredLevel}, atual ${v.currentLevel}`)
    .join('; ')
}

export const AgentManifestPluginRefSchema = z
  .union([
    z.string().min(1),
    z.object({
      id: z.string().min(1),
      config: z.record(z.string(), z.unknown()).optional(),
      requiredEnv: z.array(z.string().min(1)).optional(),
    }),
  ])
  .transform((value) => {
    if (typeof value === 'string') {
      return { id: value, config: {}, requiredEnv: [] }
    }
    return {
      id: value.id,
      config: value.config ?? {},
      requiredEnv: value.requiredEnv ?? [],
    }
  })

export type AgentManifestPluginRef = z.infer<typeof AgentManifestPluginRefSchema>

export const AgentManifestSchema = z
  .object({
    version: z.string().min(1).default('1.0.0'),
    name: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'slug deve conter apenas letras minúsculas, números e hífen'),
    level: z.enum(AGENT_LEVELS),
    capabilities: z.array(z.enum(AGENT_CAPABILITIES)).default([]),
    plugins: z.array(AgentManifestPluginRefSchema).default([]),
    prompts: z.object({
      main: z.string().min(1),
      runtimeReference: z.string().min(1).optional(),
    }),
    knowledge: z
      .object({
        path: z.string().min(1),
      })
      .optional(),
    model: z
      .object({
        provider: z.enum(['openai', 'langchain']),
        name: z.string().min(1),
      })
      .optional(),
    publisher: z
      .object({
        transport: z.literal('rabbitmq').default('rabbitmq'),
        envelope: z.string().min(1).default('uazapi'),
        source: z.string().min(1).optional(),
        requiredEnv: z.array(z.string().min(1)).default([]),
      })
      .optional(),
    media: z
      .object({
        provider: z.string().min(1).default('openai'),
        model: z.string().min(1).optional(),
      })
      .optional(),
    notes: z.array(z.string()).optional(),
  })
  .superRefine((manifest, ctx) => {
    const violations = getCapabilityLevelViolations(manifest.level, manifest.capabilities)
    if (violations.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['capabilities'],
        message: formatCapabilityLevelViolations(violations),
      })
    }
  })

export type AgentManifest = z.infer<typeof AgentManifestSchema>

export function loadManifest(agentDir: string): AgentManifest {
  const manifestPath = join(agentDir, 'agent.manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest não encontrado em ${manifestPath}`)
  }

  const raw = readFileSync(manifestPath, 'utf-8')
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (err) {
    throw new Error(`Manifest com JSON inválido em ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`)
  }

  const result = AgentManifestSchema.safeParse(json)
  if (!result.success) {
    const errors = result.error.issues.map((issue) => `  ${issue.path.join('.') || '(raiz)'}: ${issue.message}`).join('\n')
    throw new Error(`Manifest inválido em ${manifestPath}:\n${errors}`)
  }

  const manifest = result.data

  // Validate required env vars
  const missing: string[] = []
  for (const plugin of manifest.plugins) {
    for (const key of plugin.requiredEnv) {
      if (!process.env[key]?.trim()) {
        missing.push(`${plugin.id} -> ${key}`)
      }
    }
  }

  if (manifest.publisher) {
    const label = `publisher(${manifest.publisher.envelope})`
    for (const key of manifest.publisher.requiredEnv) {
      if (!process.env[key]?.trim()) {
        missing.push(`${label} -> ${key}`)
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes (declaradas no manifest):\n  ${missing.join('\n  ')}`,
    )
  }

  return manifest
}
