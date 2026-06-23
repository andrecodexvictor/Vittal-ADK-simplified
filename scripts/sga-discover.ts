/**
 * SGA discovery — autentica na API Hinova SGA v2 REAL e sonda os endpoints de
 * listagem para descobrir (a) os shapes reais de resposta e (b) os códigos
 * operacionais (status/tipo/departamento de atendimento, situação de boleto,
 * regional, produto, situação, vistoria) que hoje são placeholder no .env.
 *
 * Uso:
 *   bun run scripts/sga-discover.ts --agent aprovauto-ai [--channel whatsapp]
 *
 * Pré-requisito: agents/<slug>/<channel>/.env preenchido com
 *   SGA_BASE_URL, SGA_API_TOKEN, SGA_USUARIO, SGA_SENHA (e SGA_MOCK=false).
 *
 * Saída (GITIGNORED — pode conter PII de associado):
 *   agents/<slug>/<channel>/spec/_discovery/<label>.json   (resposta crua)
 *   agents/<slug>/<channel>/spec/_discovery/SUMMARY.md      (códigos + status)
 *
 * É read-only no SGA: só chama endpoints de listagem/busca. Nada de cadastro.
 */
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import dotenv from 'dotenv'

// ── 1. Resolve agent + load its .env (mirrors scripts/run-agent.ts) ──
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
  console.error('\nErro: slug do agente é obrigatório.')
  console.error('Uso: bun run scripts/sga-discover.ts --agent <slug> [--channel <canal>]\n')
  process.exit(1)
}

const agentDir = join(process.cwd(), 'agents', agentSlug, channel)
if (!existsSync(agentDir)) {
  console.error(`\nErro: diretório do agente não encontrado: ${agentDir}\n`)
  process.exit(1)
}

dotenv.config({ path: join(agentDir, '.env'), override: true })
process.env.AGENT_DIR = agentDir
process.env.NODE_ENV = 'production'
// Discovery must hit the REAL API regardless of the .env switch.
process.env.SGA_MOCK = 'false'

// Import config/SgaClient AFTER env is loaded.
const { config } = await import('../src/core/config')
const { SgaClient } = await import('../src/services/SgaClient')

if (!config.sgaUsuario || !config.sgaSenha || !config.sgaApiToken) {
  console.error('\nErro: faltam credenciais no .env (SGA_API_TOKEN, SGA_USUARIO, SGA_SENHA).')
  console.error(`Arquivo: ${join(agentDir, '.env')}\n`)
  process.exit(1)
}

const outDir = join(agentDir, 'spec', '_discovery')
mkdirSync(outDir, { recursive: true })

const sga = new SgaClient()

// Pagination body shared by /listar/* endpoints (convention seen in modelo/listar).
const page = { inicio_paginacao: 0, quantidade_por_pagina: 50 }

type Probe = {
  label: string
  method: 'GET' | 'POST'
  path: string
  body?: unknown
  note: string
}

// Candidate endpoints. We don't know the exact Hinova paths for the optional
// groups, so we probe several guesses per concept (convention: /listar/<entity>
// POST with pagination, /buscar/<entity>/{param} GET). The SUMMARY shows which
// returned 2xx so we lock the real path + codes.
// Convention confirmed on 1st pass: catalogs are GET /listar/<entity>/todos.
const probes: Probe[] = [
  // ── CONFIRMADOS (1ª passada) — mantidos para re-execução/regeneração ──
  { label: 'atendimento-status', method: 'GET', path: '/listar/status-atendimento/todos', note: 'SGA_CLAIM_STATUS_CODE (EM ABERTO=3)' },
  { label: 'atendimento-tipo', method: 'GET', path: '/listar/tipo-atendimento/todos', note: 'SGA_CLAIM_TYPE_CODE (SINISTRO-ABERTURA=6)' },
  { label: 'boleto-situacao', method: 'GET', path: '/listar/situacao-boleto/todos', note: 'SGA_BOLETO_OPEN_STATUS_CODE (ABERTO=2)' },
  { label: 'regional', method: 'GET', path: '/listar/regional/todos', note: 'SGA_REGIONAL_UNIT_MAP' },

  // ── Departamento → SGA_SINISTRO_DEPT_CODE (2ª passada de candidatos) ──
  { label: 'departamento-a', method: 'GET', path: '/listar/departamento/todos', note: 'SGA_SINISTRO_DEPT_CODE' },
  { label: 'departamento-b', method: 'GET', path: '/listar/departamento-atendimento/todos', note: 'SGA_SINISTRO_DEPT_CODE (alt)' },
  { label: 'departamento-c', method: 'GET', path: '/listar/setor/todos', note: 'SGA_SINISTRO_DEPT_CODE (alt setor)' },

  // ── Produto (planos/coberturas — M5/FAQ) ──
  { label: 'produto-a', method: 'GET', path: '/listar/produto/todos', note: 'catálogo de produtos' },
  { label: 'produto-b', method: 'GET', path: '/listar/produtos/todos', note: 'catálogo (alt plural)' },
  { label: 'produto-c', method: 'GET', path: '/listar/plano/todos', note: 'planos (alt)' },
  { label: 'produto-d', method: 'GET', path: '/listar/grupo-produto/todos', note: 'grupos de produto' },
  { label: 'produto-e', method: 'GET', path: '/listar/produto-protecao/todos', note: 'produtos de proteção (alt)' },
  { label: 'produto-f', method: 'GET', path: '/listar/cobertura/todos', note: 'coberturas (alt)' },

  // ── Situação (interpretação estável de status) ──
  { label: 'situacao-a', method: 'GET', path: '/listar/situacao/todos', note: 'situações genéricas' },
  { label: 'situacao-b', method: 'GET', path: '/listar/situacao-associado/todos', note: 'situações de associado' },
  { label: 'situacao-c', method: 'GET', path: '/listar/situacao-evento/todos', note: 'situações de evento' },
  { label: 'situacao-d', method: 'GET', path: '/listar/situacao-veiculo/todos', note: 'situações de veículo' },

  // ── Vistoria → POST com intervalo de datas (descoberto via 406) ──
  { label: 'vistoria-periodo', method: 'POST', path: '/listar/vistoria', body: { data_vistoria_inicial: '01/01/2026', data_vistoria_final: '31/12/2026', ...page }, note: 'vistorias por período' },
  { label: 'vistoria-tipo', method: 'GET', path: '/listar/tipo-vistoria/todos', note: 'tipos de vistoria' },
  { label: 'vistoria-situacao', method: 'GET', path: '/listar/situacao-vistoria/todos', note: 'situações de vistoria' },
]

// Summarize a response: top-level shape + keys of first item (NO values, to
// keep SUMMARY skimmable; full body with values goes to the per-probe file).
function shapeOf(data: unknown): string {
  if (Array.isArray(data)) {
    const first = data[0]
    const keys = first && typeof first === 'object' ? Object.keys(first as object) : []
    return `array[${data.length}] item keys: ${keys.join(', ') || '(escalar)'}`
  }
  if (data && typeof data === 'object') {
    return `object keys: ${Object.keys(data as object).join(', ')}`
  }
  return `escalar: ${String(data)}`
}

const results: Array<{ probe: Probe; ok: boolean; status?: number; shape?: string; error?: string }> = []

console.log(`\n🔎 Descoberta SGA — ${agentSlug}/${channel} → ${config.sgaBaseUrl}`)
console.log(`   Saída: ${outDir}\n`)

for (const probe of probes) {
  try {
    const data = await sga.requestRaw(probe.method, probe.path, probe.body)
    const shape = shapeOf(data)
    writeFileSync(join(outDir, `${probe.label}.json`), JSON.stringify(data, null, 2))
    results.push({ probe, ok: true, status: 200, shape })
    console.log(`✅ ${probe.label.padEnd(22)} ${probe.method} ${probe.path}  → ${shape}`)
  } catch (err: any) {
    const status = err?.status as number | undefined
    const message = err?.message ? String(err.message) : String(err)
    writeFileSync(join(outDir, `${probe.label}.ERROR.txt`), message)
    results.push({ probe, ok: false, status, error: message })
    console.log(`❌ ${probe.label.padEnd(22)} ${probe.method} ${probe.path}  → ${status ?? '?'}`)
  }
}

// ── Write SUMMARY.md ──
const lines: string[] = []
lines.push('# SGA Discovery — SUMMARY')
lines.push('')
lines.push(`Base: ${config.sgaBaseUrl}`)
lines.push('')
lines.push('> Gerado por scripts/sga-discover.ts. Pasta gitignored (pode conter PII).')
lines.push('')
lines.push('## Endpoints que responderam (2xx)')
lines.push('')
lines.push('| Label | Método | Path | Resolve | Shape |')
lines.push('|---|---|---|---|---|')
for (const r of results.filter((r) => r.ok)) {
  lines.push(`| ${r.probe.label} | ${r.probe.method} | \`${r.probe.path}\` | ${r.probe.note} | ${r.shape} |`)
}
lines.push('')
lines.push('## Endpoints que falharam')
lines.push('')
lines.push('| Label | Path | Status | Provável motivo |')
lines.push('|---|---|---|---|')
for (const r of results.filter((r) => !r.ok)) {
  const reason =
    r.status === 404 ? 'path errado (tentar alternativa)' : r.status === 403 ? 'sem permissão na chave' : 'ver .ERROR.txt'
  lines.push(`| ${r.probe.label} | \`${r.probe.path}\` | ${r.status ?? '?'} | ${reason} |`)
}
lines.push('')
lines.push('## Próximos passos')
lines.push('- Para cada concept que resolveu, abrir o `<label>.json` e ler os códigos reais.')
lines.push('- Preencher no `.env`: SGA_CLAIM_STATUS_CODE, SGA_CLAIM_TYPE_CODE, SGA_SINISTRO_DEPT_CODE, SGA_BOLETO_OPEN_STATUS_CODE.')
lines.push('- Montar SGA_REGIONAL_UNIT_MAP a partir do regional-listar.')
writeFileSync(join(outDir, 'SUMMARY.md'), lines.join('\n'))

const okCount = results.filter((r) => r.ok).length
console.log(`\n📋 SUMMARY: ${outDir}/SUMMARY.md`)
console.log(`   ${okCount}/${probes.length} endpoints responderam 2xx.\n`)
