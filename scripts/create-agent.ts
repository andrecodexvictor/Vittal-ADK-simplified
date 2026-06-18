import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'

const rawName = process.argv[2]?.trim()
const description = process.argv[3]?.trim()
const channel = process.argv[4]?.trim() || 'whatsapp'

if (!rawName) {
  console.error('\nUso: bun run create-agent "Nome do Cliente" ["Descricao opcional"] ["canal_opcional"]\n')
  console.error('Exemplos:')
  console.error('  bun run create-agent "Nome da Empresa"')
  console.error('  bun run create-agent "Nome da Empresa" "Agente de atendimento" "whatsapp"\n')
  process.exit(1)
}

const slug = slugify(rawName)
const agentDescription = description ?? `Agente de atendimento da ${rawName}`
const targetDir = join(process.cwd(), 'agents', slug, channel)
const templatesDir = join(process.cwd(), 'templates', 'agent')

const hubBaseUrl = process.env.HUB_BASE_URL ?? 'https://hub.vittalweb.com'
const hubApiKey = process.env.HUB_API_KEY

printHeader(`Criando agente: ${rawName} (${channel})`)
step(`Slug: ${slug}`)
step(`Descrição: ${agentDescription}`)

// 1. Verify if agent already exists
try {
  await access(targetDir, constants.F_OK)
  fail(`Agente '${slug}' no canal '${channel}' já existe em agents/${slug}/${channel}/`)
} catch (err: any) {
  if (err.code !== 'ENOENT') throw err
}

// 2. Hub Registration (Optional / Offline-first)
let agentId: string | undefined
let agentApiKey: string | undefined

if (!hubApiKey) {
  warn('HUB_API_KEY não encontrado no .env — pulando registro no Hub.')
  warn('Defina HUB_API_KEY no .env raiz e rode novamente para registrar no Hub.')
} else {
  log('Registrando agente no Hub...')
  try {
    const response = await fetch(`${hubBaseUrl}/api/ai-hub/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': `${hubApiKey}`,
      },
      body: JSON.stringify({
        slug: `${slug}-${channel}`,
        name: `${rawName} (${channel})`,
        type: 'assistant',
        description: agentDescription,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`HTTP ${response.status} — ${body}`)
    }

    const data = (await response.json()) as { id: string; api_key: string }
    agentId = data.id
    agentApiKey = data.api_key
    ok(`Agente registrado no Hub (id: ${agentId})`)
  } catch (err) {
    warn(`Falha ao registrar no Hub: ${err instanceof Error ? err.message : String(err)}`)
    warn('Continuando em modo offline-first. Preencha HUB_AGENT_KEY no .env manualmente.')
  }
}

// 3. Create agent directory structure
await mkdir(join(targetDir, 'spec'), { recursive: true })
await mkdir(join(targetDir, 'prompts'), { recursive: true })
await mkdir(join(targetDir, 'tests'), { recursive: true })
await mkdir(join(targetDir, 'knowledge'), { recursive: true })
ok(`Diretórios criados em agents/${slug}/${channel}/`)

// 4. Copy and interpolate templates
const copyAndFillTemplate = async (srcRel: string, destRel: string) => {
  const srcPath = join(templatesDir, srcRel)
  const destPath = join(targetDir, destRel)
  try {
    const content = await readFile(srcPath, 'utf-8')
    const filled = content
      .replace(/\[NOME DA EMPRESA\]/g, rawName)
      .replace(/\[SLUG\]/g, slug)
    await writeFile(destPath, filled)
    ok(`Criado: ${destRel}`)
  } catch (err) {
    fail(`Falha ao copiar template de ${srcRel} para ${destRel}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

await copyAndFillTemplate(join('spec', 'PRD_AGENT.md'), join('spec', 'PRD_AGENT.md'))
await copyAndFillTemplate(join('spec', 'flows.md'), join('spec', 'flows.md'))
await copyAndFillTemplate(join('spec', 'examples.md'), join('spec', 'examples.md'))
await copyAndFillTemplate(join('spec', 'tasks.md'), join('spec', 'tasks.md'))
await copyAndFillTemplate(join('prompts', 'system.md'), join('prompts', 'system.md'))
await copyAndFillTemplate(join('tests', 'agent.test.ts'), join('tests', 'agent.test.ts'))

await writeFile(join(targetDir, 'knowledge', '.gitkeep'), '')
ok('knowledge/.gitkeep criado')

// 5. Generate agent.manifest.json
const manifest = {
  version: '1.0.0',
  name: rawName,
  slug,
  ...(agentId ? { hub: { id: agentId } } : {}),
  level: 'informational',
  capabilities: ['faq', 'lead_qualification', 'handoff'],
  plugins: [
    {
      id: 'builtin.handoff',
      config: {},
      requiredEnv: ['HANDOFF_ATTENDANTS'],
    },
  ],
  publisher: {
    transport: 'rabbitmq',
    envelope: 'uazapi',
    source: slug,
    requiredEnv: [],
  },
  prompts: {
    main: 'prompts/system.md',
  },
  knowledge: {
    path: 'knowledge',
  },
  notes: [
    'Manifest é a fonte de verdade para level/capabilities/plugins/publisher.',
    'Níveis: informational | transactional | orchestrator',
    'Use transactional para ferramentas que realizam side-effects.',
  ],
}

await writeFile(join(targetDir, 'agent.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
ok('agent.manifest.json criado')

// 6. Generate .env and .env.example
const envExample = buildEnv({ hubBaseUrl, hubAgentKey: '', slug, channel })
const envFilled = buildEnv({ hubBaseUrl, hubAgentKey: agentApiKey ?? '', slug, channel })

await writeFile(join(targetDir, '.env.example'), envExample)
await writeFile(join(targetDir, '.env'), envFilled)
ok('.env e .env.example criados')

// 7. Success summary
printDivider()
console.log(`  Agente   : ${rawName}`)
console.log(`  Canal    : ${channel}`)
console.log(`  Diretório: agents/${slug}/${channel}/`)
if (agentId) console.log(`  Hub ID   : ${agentId}`)
if (agentApiKey) console.log(`  API Key  : ${agentApiKey}`)
printDivider()
console.log('\nPróximos passos:')
console.log(`  1. Complete o PRD do agente em agents/${slug}/${channel}/spec/PRD_AGENT.md`)
console.log(`  2. Customize o prompt em agents/${slug}/${channel}/prompts/system.md`)
console.log(`  3. Insira documentos de RAG em agents/${slug}/${channel}/knowledge/`)
console.log(`  4. Preencha as credenciais em agents/${slug}/${channel}/.env`)
console.log(`  5. Execute os testes offline: bun test agents/${slug}/${channel}/tests`)
console.log(`  6. Rode localmente: bun dev --agent ${slug}`)
console.log()

// Helpers
function buildEnv(params: {
  hubBaseUrl: string
  hubAgentKey: string
  slug: string
  channel: string
}): string {
  const { hubBaseUrl, hubAgentKey, slug } = params
  return [
    '# ── WEBHOOK ─────────────────────────────────────────────────────────────────',
    '# Token para validar requisições da UAZAPI',
    'WEBHOOK_SECRET=',
    '',
    '# ── VITTAL HUB ──────────────────────────────────────────────────────────────',
    `HUB_BASE_URL=${hubBaseUrl}`,
    `HUB_AGENT_KEY=${hubAgentKey}`,
    '',
    '# ── OPENAI ───────────────────────────────────────────────────────────────────',
    'OPENAI_API_KEY=',
    'OPENAI_MODEL=gpt-4o-mini',
    'OPENAI_MAX_TOKENS=1024',
    'OPENAI_TEMPERATURE=0.6',
    'OPENAI_TOP_P=1.0',
    'OPENAI_HISTORY_LIMIT=20',
    '',
    '# ── RABBITMQ ─────────────────────────────────────────────────────────────────',
    'RABBITMQ_URL=amqp://user:pass@host:5672',
    'RABBITMQ_EXCHANGE=vittal.messages',
    'RABBITMQ_ROUTING_KEY=message.direct',
    '',
    '# ── OUTBOUND / UAZAPI ────────────────────────────────────────────────────────',
    'OUTBOUND_PROVIDER=uazapi',
    `OUTBOUND_SOURCE=${slug}`,
    'UAZAPI_URL=https://flowcrm.uazapi.com',
    'UAZAPI_TOKEN=',
    '# OPCIONAL: URL para envio direto de mídia HTTP se necessário',
    'UAZAPI_BASE_URL=',
    '',
    '# ── FEATURE FLAGS ────────────────────────────────────────────────────────────',
    'FEATURE_RESPONDER_GRUPOS=false',
    'FEATURE_FOLLOW_UP=false',
    'FEATURE_ACIONAR_ATENDENTE=true',
    'FEATURE_RAG=true',
    'FEATURE_PROCESSAR_AUDIO=false',
    'FEATURE_PROCESSAR_IMAGEM=false',
    'FEATURE_GROUP_NOTIFICATIONS=false',
    'FEATURE_CAMPANHAS=false',
    '',
    '# ── TRIGGERS & FILTROS ───────────────────────────────────────────────────────',
    'TRIGGER_WORD=',
    'WHITELIST_NUMBERS=',
    'WHITELIST_GROUPS=',
    '',
    '# ── HANDOFF ──────────────────────────────────────────────────────────────────',
    'HANDOFF_ATTENDANTS=',
    'HANDOFF_ANNOUNCEMENT_GROUP=',
    '',
    '# ── APP ──────────────────────────────────────────────────────────────────────',
    'AGENT_LEVEL=informational',
    'AGENT_CAPABILITIES=faq,lead_qualification,handoff',
    'DEBOUNCE_MS=3000',
    'PORT=3000',
    'LOG_LEVEL=info',
    '',
  ].join('\n')
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function printHeader(msg: string): void {
  const line = '─'.repeat(Math.min(60, msg.length + 4))
  console.log(`\n${line}`)
  console.log(`  ${msg}`)
  console.log(`${line}\n`)
}

function printDivider(): void {
  console.log('─'.repeat(60))
}

function step(msg: string): void {
  console.log(`  ${msg}`)
}

function log(msg: string): void {
  console.log(`\n→ ${msg}`)
}

function ok(msg: string): void {
  console.log(`  ✓ ${msg}`)
}

function warn(msg: string): void {
  console.warn(`  ⚠  ${msg}`)
}

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}
