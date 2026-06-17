import { config } from './core/config'
import { loadManifest } from './core/manifest'
import { logger } from './core/logger'
import { ProcessMessage } from './core/ProcessMessage'
import { createServer } from './presentation/server'

// 1. Resolve agent directory and load its manifest
const agentDir = process.env.AGENT_DIR
if (!agentDir) {
  throw new Error('AGENT_DIR environment variable is required to start the agent')
}

logger.info({ agentDir }, 'Inicializando agente a partir do diretório')
const manifest = loadManifest(agentDir)

// 2. Instantiate core ProcessMessage coordinator
const processMessage = new ProcessMessage(manifest, agentDir)

// 3. Create Hono server
const app = createServer(processMessage)

// 4. Start Bun server
const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
})

logger.info(
  { port: config.port, slug: manifest.slug, level: manifest.level },
  `🤖 Agent [${manifest.name}] running on port ${config.port} via Bun`,
)

// Graceful shutdown handlers
const shutdown = () => {
  logger.info('Stopping server gracefully...')
  server.stop()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
