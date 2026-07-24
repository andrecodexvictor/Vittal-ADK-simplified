/**
 * billing-runner.ts — Régua de cobrança ativa (M3).
 *
 * Worker proativo (separado do fluxo inbound). Varre boletos em ABERTO numa
 * janela de vencimento, classifica em estágios da régua, respeita a janela D+1
 * (pagamento processado manualmente, baixa no dia seguinte) e dispara lembretes
 * de tom suave via RabbitMQ — apenas para quem tem boleto em aberto.
 *
 * Idempotência/cadência: ledger persistente em .billing-cache/ledger.json —
 * 1 lembrete por boleto+estágio (o estágio "vencido" repete a cada 7 dias,
 * ver shouldRemind em ./lib/billing-rules).
 *
 * Uso:
 *   bun run scripts/billing-runner.ts --agent aprovauto-ai [--dry-run] [--live]
 *
 * Agendamento (produção): Dokploy schedule / cron diário. Mantenha BILLING_DRY_RUN=true
 * até validar a seleção no gate do dia 60; depois BILLING_DRY_RUN=false (ou --live).
 */
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import dotenv from 'dotenv'
import type { SgaBoletoListItem } from '../src/services/SgaClient'
import { addDays, buildMessage, classify, fmtDate, parseDue, shouldRemind, type Stage } from './lib/billing-rules'

// ── 1. CLI + env bootstrap (mesmo padrão do run-agent) ──
const argv: Record<string, string> = {}
for (let i = 0; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a?.startsWith('--')) {
    const next = process.argv[i + 1]
    if (next && !next.startsWith('--')) { argv[a.slice(2)] = next; i++ } else { argv[a.slice(2)] = 'true' }
  }
}
const agentSlug = argv.agent || process.env.AGENT_SLUG || 'aprovauto-ai'
const channel = argv.channel || 'whatsapp'
const agentDir = join(process.cwd(), 'agents', agentSlug, channel)
if (!existsSync(agentDir)) {
  console.error(`Agente não encontrado: ${agentDir}`)
  process.exit(1)
}
dotenv.config({ path: join(agentDir, '.env'), override: true })
process.env.AGENT_DIR = agentDir
process.env.AGENT_SLUG = agentSlug
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production'

// --dry-run forces dry; --live forces real send (overrides BILLING_DRY_RUN)
if (argv['dry-run'] === 'true') process.env.BILLING_DRY_RUN = 'true'
if (argv.live === 'true') process.env.BILLING_DRY_RUN = 'false'

const { config } = await import('../src/core/config')
const { logger } = await import('../src/core/logger')
const { SgaClient } = await import('../src/services/SgaClient')
const { RabbitMQPublisher } = await import('../src/services/RabbitMQ')

// ── 2. Régua: parâmetros (lógica pura em ./lib/billing-rules) ──
const PREVENTIVE_LEAD_DAYS = 3 // lembrete amigável N dias antes do vencimento

// ── 3. Cadência (ledger boleto:estágio → yyyy-mm-dd do último envio) ──
const cacheDir = join(process.cwd(), '.billing-cache')
const ledgerFile = join(cacheDir, 'ledger.json')
function loadLedger(): Record<string, string> {
  if (!existsSync(ledgerFile)) return {}
  try { return JSON.parse(readFileSync(ledgerFile, 'utf8')) } catch { return {} }
}
function saveLedger(ledger: Record<string, string>): void {
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })
  writeFileSync(ledgerFile, JSON.stringify(ledger), 'utf8')
}

// ── 5. Run ──
async function main() {
  const today = new Date()
  const dryRun = config.billingDryRun
  const log = logger.child({ worker: 'billing-runner', agent: agentSlug, dryRun })

  if (!config.sgaUsuario || !config.sgaSenha) {
    log.warn('SGA_USUARIO/SGA_SENHA ausentes — abortando (necessário para autenticar na régua).')
    process.exit(1)
  }

  const sga = new SgaClient()
  // Janela: de 31 dias atrás (vencidos) até PREVENTIVE_LEAD_DAYS à frente (preventivos). Limite Hinova: 31 dias.
  const windowStart = addDays(today, -28)
  const windowEnd = addDays(today, PREVENTIVE_LEAD_DAYS)

  log.info({ from: fmtDate(windowStart), to: fmtDate(windowEnd) }, 'Varrendo boletos em aberto na janela')

  const targets: { item: SgaBoletoListItem; stage: Stage }[] = []
  for (let page = 0; page < config.billingMaxPages; page++) {
    let boletos: SgaBoletoListItem[] = []
    try {
      boletos = await sga.listBoletosByPeriod({
        dueDateStart: fmtDate(windowStart),
        dueDateEnd: fmtDate(windowEnd),
        pageStart: page * config.billingPageSize,
      })
    } catch (err) {
      log.error({ err, page }, 'Falha ao listar boletos — interrompendo varredura')
      break
    }
    if (boletos.length === 0) break

    for (const item of boletos) {
      const due = parseDue(item.dueDate)
      if (!due || !item.phone) continue
      const stage = classify(due, today, {
        graceDays: config.billingOverdueGraceDays,
        preventiveLeadDays: PREVENTIVE_LEAD_DAYS,
      })
      if (stage) targets.push({ item, stage })
    }
    if (boletos.length < config.billingPageSize) break
  }

  log.info({ count: targets.length }, 'Boletos elegíveis para lembrete')

  const ledger = loadLedger()
  const todayIso = today.toISOString().slice(0, 10)
  let published = 0
  let skipped = 0
  const publisher = dryRun ? null : new RabbitMQPublisher(agentSlug, 'uazapi')
  const instanceName = config.outboundSource || agentSlug

  try {
    for (const { item, stage } of targets) {
      const key = `${item.invoiceId}:${stage}`
      if (!shouldRemind(ledger[key], stage, today)) { skipped++; continue }
      const phone = item.phone as string
      const message = buildMessage(item, stage)

      if (dryRun) {
        log.info({ phone: `***${phone.slice(-4)}`, stage, valor: item.amount, invoice: item.invoiceId }, '[DRY-RUN] lembrete não enviado')
      } else {
        // Teto anti-ban: para de enviar e deixa o restante para a próxima execução
        // (o ledger só marca o que foi enviado).
        if (published >= config.billingMaxSendsPerRun) {
          log.warn({ cap: config.billingMaxSendsPerRun }, 'Teto de envios por execução atingido — restante fica para a próxima execução')
          break
        }
        try {
          await publisher?.publish(phone, message, instanceName, false)
          published++
        } catch (err) {
          log.error({ err, invoice: item.invoiceId }, 'Falha ao publicar lembrete')
          continue
        }
      }
      ledger[key] = todayIso
    }
  } finally {
    if (publisher) await publisher.close()
  }

  if (!dryRun) saveLedger(ledger)

  log.info({ eligible: targets.length, published, skipped, dryRun }, 'Régua concluída')
}

await main()
process.exit(0)
