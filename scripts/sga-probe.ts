/**
 * sga-probe.ts — diagnóstico rápido read-only da API Hinova SGA v2 REAL.
 *
 * Autentica (two-step) e bate nos endpoints que o agente usa em runtime,
 * imprimindo SOMENTE status/contagem (sem valores → sem PII). Serve para
 * distinguir: auth falhou (401) × rota não habilitada (403) × path errado (404)
 * × API ok mas código de match ruim (200).
 *
 * Uso: bun run scripts/sga-probe.ts --agent aprovauto-ai
 */
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import dotenv from 'dotenv'

const args: Record<string, string> = {}
for (let i = 0; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a?.startsWith('--')) {
    const v = process.argv[i + 1]
    if (v && !v.startsWith('--')) { args[a.slice(2)] = v; i++ } else { args[a.slice(2)] = 'true' }
  }
}
const slug = args.agent || 'aprovauto-ai'
const channel = args.channel || 'whatsapp'
const agentDir = join(process.cwd(), 'agents', slug, channel)
if (!existsSync(agentDir)) { console.error(`Agente não encontrado: ${agentDir}`); process.exit(1) }

dotenv.config({ path: join(agentDir, '.env'), override: true })
process.env.AGENT_DIR = agentDir
process.env.NODE_ENV = 'production'
process.env.SGA_MOCK = 'false' // probe sempre na API real

const { config } = await import('../src/core/config')
const { SgaClient } = await import('../src/services/SgaClient')

if (!config.sgaUsuario || !config.sgaSenha || !config.sgaApiToken) {
  console.error('Faltam credenciais (SGA_API_TOKEN/USUARIO/SENHA) no .env.'); process.exit(1)
}

const sga = new SgaClient()
const sample = String(args.plate || '').trim()
const sampleModel = String(args.model || 'civic').trim()

console.log(`\n🔎 Probe SGA REAL — ${slug} → ${config.sgaBaseUrl}\n`)

type Row = { label: string; run: () => Promise<unknown> }
const rows: Row[] = [
  { label: 'auth (/usuario/autenticar)', run: () => sga.requestRaw('POST', '/usuario/autenticar', { usuario: config.sgaUsuario, senha: config.sgaSenha }) },
  { label: 'search_vehicle por modelo (/modelo/listar)', run: () => sga.requestRaw('POST', '/modelo/listar', { situacao: 'ativo', inicio_paginacao: 0, quantidade_por_pagina: 50 }) },
  { label: 'list_products (/listar/grupo-produto/todos)', run: () => sga.requestRaw('GET', '/listar/grupo-produto/todos') },
  { label: 'regionais (/listar/regional/todos)', run: () => sga.requestRaw('GET', '/listar/regional/todos') },
]
if (sample) rows.push({ label: `search_vehicle por placa (/veiculo/buscar-por-permissao/${sample})`, run: () => sga.requestRaw('GET', `/veiculo/buscar-por-permissao/${encodeURIComponent(sample)}/`) })

for (const r of rows) {
  try {
    const data: any = await r.run()
    const n = Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data).length : 0)
    const kind = Array.isArray(data) ? `array[${n}]` : `object(${n} keys)`
    console.log(`✅ 200  ${r.label.padEnd(48)} → ${kind}`)
  } catch (e: any) {
    console.log(`❌ ${String(e?.status ?? '?').padEnd(3)}  ${r.label.padEnd(48)} → ${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 120)}`)
  }
}

// Bônus: confirma se o match por nome de modelo do código real acharia "civic"/"tiggo".
try {
  const v = await sga.searchVehicle({ modelName: sampleModel })
  console.log(`\nℹ️  searchVehicle({modelName:"${sampleModel}"}) resolveu → "${v.modelName}" (marca ${v.brand ?? '?'}, fipe ${v.fipeValue})`)
} catch (e: any) {
  console.log(`\nℹ️  searchVehicle({modelName:"${sampleModel}"}) lançou → ${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 120)}`)
}
console.log('')
