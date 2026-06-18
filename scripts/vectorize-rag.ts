import { existsSync } from 'node:fs'
import { join } from 'node:path'
import dotenv from 'dotenv'

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

const agentSlug = args.agent || process.env.AGENT_SLUG || 'aprovauto-ai'
const channel = args.channel || process.env.AGENT_CHANNEL || 'whatsapp'
const agentDir = join(process.cwd(), 'agents', agentSlug, channel)
const envPath = join(agentDir, '.env')

if (!existsSync(agentDir)) {
  throw new Error(`Agent directory not found: ${agentDir}`)
}

dotenv.config({ path: envPath, override: true })
process.env.AGENT_DIR = agentDir
process.env.AGENT_SLUG = agentSlug
process.env.AGENT_CHANNEL = channel

if (!process.env.OPENAI_API_KEY?.trim()) {
  throw new Error('OPENAI_API_KEY is required to vectorize RAG knowledge')
}

const { LangChainRag } = await import('../src/services/LangChainRag')
const rag = new LangChainRag(agentDir)
const result = await rag.query('AprovaAuto coberturas assistência sinistro financeiro endereço horário', 3)

console.log(
  JSON.stringify(
    {
      agent: agentSlug,
      channel,
      knowledgeDir: join(agentDir, 'knowledge'),
      cacheDir: join(agentDir, 'knowledge', '.rag-cache'),
      chunksReturned: result.chunks.length,
      embeddingTokens: result.embeddingTokens,
      embeddingCostUsd: result.embeddingCostUsd,
    },
    null,
    2,
  ),
)
