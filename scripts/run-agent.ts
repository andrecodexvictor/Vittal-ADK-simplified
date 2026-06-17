import { join } from 'node:path'
import { existsSync } from 'node:fs'
import dotenv from 'dotenv'

// 1. Parse command-line arguments (e.g. bun run-agent --agent clinica-bela-pele --channel whatsapp)
const args: Record<string, string> = {}
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg?.startsWith('--')) {
    const key = arg.slice(2)
    const val = process.argv[i + 1]
    if (val && !val.startsWith('--')) {
      args[key] = val
      i++
    } else {
      args[key] = 'true'
    }
  }
}

const agentSlug = args.agent || process.env.AGENT_SLUG
const channel = args.channel || process.env.AGENT_CHANNEL || 'whatsapp'

if (!agentSlug) {
  console.error('\nErro: Slug do agente é obrigatório.')
  console.error('Uso: bun run scripts/run-agent.ts --agent <slug> [--channel <canal>]\n')
  process.exit(1)
}

const agentDir = join(process.cwd(), 'agents', agentSlug, channel)

if (!existsSync(agentDir)) {
  console.error(`\nErro: Diretório do agente não encontrado: ${agentDir}\n`)
  process.exit(1)
}

// 2. Load agent-specific environment variables, overriding any root defaults
console.log(`\n🤖 Carregando configurações para [${agentSlug}] (${channel})...`)
dotenv.config({ path: join(agentDir, '.env'), override: true })

// 3. Inject configuration variables to ensure correct paths in main.ts
process.env.AGENT_DIR = agentDir
process.env.AGENT_SLUG = agentSlug
process.env.AGENT_CHANNEL = channel

// 4. Run checking or type validation if in dev mode
if (args.dev === 'true') {
  process.env.NODE_ENV = 'development'
} else {
  process.env.NODE_ENV = 'production'
}

// 5. Bootstrap the main server
await import('../src/main')
