/**
 * wa-sim-server.ts — Simulador WhatsApp interativo (inspirado no WaFlow).
 *
 * Sobe um servidor HTTP com uma UI de chat estilo WhatsApp no navegador. Cada
 * mensagem digitada passa pelo PIPELINE REAL do agente (system prompt + RAG-like
 * FAQ + getActiveTools + tool-calling nativo do OpenAI). O SGA é mockado
 * deterministicamente (mesmo mock do simulate-agent); o LLM é real (usa a
 * OPENAI_API_KEY do .env do agente). Mantém histórico e estado de handoff por
 * sessão de chat.
 *
 * Uso:
 *   bun run scripts/wa-sim-server.ts --agent aprovauto-ai [--port 3001]
 *   abra http://localhost:3001
 */
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import dotenv from 'dotenv'

// ── 1. CLI + env bootstrap ──
const argv: Record<string, string> = {}
for (let i = 0; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a?.startsWith('--')) {
    const next = process.argv[i + 1]
    if (next && !next.startsWith('--')) { argv[a.slice(2)] = next; i++ } else { argv[a.slice(2)] = 'true' }
  }
}
const agentSlug = argv.agent || 'aprovauto-ai'
const port = Number(argv.port || 3001)
const agentDir = join(process.cwd(), 'agents', agentSlug, 'whatsapp')
if (!existsSync(agentDir)) {
  console.error(`Agente não encontrado: ${agentDir}`)
  process.exit(1)
}
dotenv.config({ path: join(agentDir, '.env'), override: true })
process.env.AGENT_DIR = agentDir
process.env.NODE_ENV = 'production'
process.env.FEATURE_ACIONAR_ATENDENTE = 'true'
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent'
const fallback: Record<string, string> = {
  WEBHOOK_SECRET: 'sim', HUB_AGENT_KEY: 'sim', RABBITMQ_URL: 'amqp://localhost', RABBITMQ_EXCHANGE: 'sim',
  RABBITMQ_ROUTING_KEY: 'sim', UAZAPI_TOKEN: 'sim', HANDOFF_ATTENDANTS: '5511999999999',
  SGA_USUARIO: 'sim-user', SGA_SENHA: 'sim-pass', SGA_DEFAULT_REGIONAL: '9', SGA_CLAIM_STATUS_CODE: '10',
  SGA_CLAIM_TYPE_CODE: '20', SGA_SINISTRO_DEPT_CODE: '30', SGA_BOLETO_OPEN_STATUS_CODE: '2',
}
for (const [k, v] of Object.entries(fallback)) if (!process.env[k]) process.env[k] = v

const { config } = await import('../src/core/config')
const { loadManifest } = await import('../src/core/manifest')
const { getActiveTools } = await import('../src/core/plugins')
const { OpenAIProvider } = await import('../src/services/OpenAIProvider')
const { __resetSgaState } = await import('../src/services/SgaClient')
const { installSgaMock } = await import('./lib/sga-mock')
const { installCrmMock } = await import('./lib/crm-mock')

if (!config.openaiApiKey || config.openaiApiKey.startsWith('sk-verify')) {
  console.warn('⚠️  OPENAI_API_KEY ausente/placeholder no .env do agente — o LLM não responderá. Configure para testar de verdade.')
}

// Respeita a switch SGA_MOCK: com SGA_MOCK=false o chat bate na API real da Hinova
// (para testes com dados reais via túnel); caso contrário usa o mock determinístico.
if (config.sgaMock) {
  installSgaMock(config.sgaBaseUrl)
  console.log('🧪 SGA_MOCK=true — usando mock determinístico (dados fictícios)')
} else {
  console.log('🌐 SGA_MOCK=false — usando a API real da Hinova (dados reais)')
}
// CRM real ainda sem doc: com CRM_MOCK=true o lead/qualificação roda no mock.
if (config.crmMock) {
  installCrmMock(config.crmBaseUrl)
  console.log('🧪 CRM_MOCK=true — CRM mockado (sem CRM real)')
}

const manifest = loadManifest(agentDir)
const tools = getActiveTools(manifest)
const provider = new OpenAIProvider()
let systemPrompt = readFileSync(join(agentDir, 'prompts', 'system.md'), 'utf8')
const faqPath = join(agentDir, 'knowledge', 'aprovauto_faq.md')
if (existsSync(faqPath)) {
  systemPrompt += `\n\n## BASE DE CONHECIMENTO (RAG)\nUse os fatos abaixo para responder dúvidas. Não invente o que não estiver aqui.\n\n${readFileSync(faqPath, 'utf8')}`
}
const FAKE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

// ── 2. Per-session state ──
type Msg = { role: 'user' | 'assistant'; content: string }
type Session = { history: Msg[]; state: any; services: any }
const sessions = new Map<string, Session>()

function makeSession(): Session {
  const state = { metadata: {} as Record<string, any>, paused: false, logs: [] as any[], handoffMessages: [] as any[] }
  const services = {
    repository: {
      async addLog(_e: string, log: any) { state.logs.push(log) },
      async getConversationMetadata() { return state.metadata },
      async mergeConversationMetadata(_c: string, patch: Record<string, unknown>) { state.metadata = { ...state.metadata, ...patch } },
      async setAgentState() { state.paused = true },
    },
    publisher: { async publish(phone: string, text: string) { state.handoffMessages.push({ phone, text }) } },
    handoff: { getNextAttendant() { return '5511999999999' }, async pauseAgent(_c: string, repo: any) { await repo.setAgentState() } },
  }
  return { history: [], state, services }
}

function getSession(id: string): Session {
  let s = sessions.get(id)
  if (!s) { s = makeSession(); sessions.set(id, s) }
  return s
}

async function handleMessage(sessionId: string, text: string, withMedia: boolean) {
  const session = getSession(sessionId)
  const toolsSeen: string[] = []
  const ctx: any = {
    conversationId: `sim-${sessionId}`, executionId: `exec-${sessionId}-${session.history.length}`,
    instanceName: 'wa-sim', senderPhone: '5511900000000', contactName: 'Cliente Sim', services: session.services,
  }
  if (withMedia) { ctx.currentMedia = { type: 'image', dataUri: FAKE_PNG, mimeType: 'image/png' }; ctx.imageUrl = FAKE_PNG }

  const res = await provider.completeWithTools({
    systemPrompt, history: session.history, userMessage: text, tools,
    executeTool: async (name: string, args: any) => {
      const tool = tools.find((x: any) => x.name === name)
      if (!tool) return { toolName: name, input: args, output: { error: 'tool_not_found' }, status: 'error' as const }
      toolsSeen.push(name)
      const parsed = tool.inputSchema.safeParse(args)
      if (!parsed.success) return { toolName: name, input: args, output: { error: 'invalid_arguments', detail: parsed.error.issues }, status: 'error' as const }
      try {
        const output = await tool.execute(parsed.data, ctx)
        return { toolName: name, input: args, output, status: 'success' as const }
      } catch (e) {
        return { toolName: name, input: args, output: { error: String(e) }, status: 'error' as const }
      }
    },
  })

  session.history.push({ role: 'user', content: text }, { role: 'assistant', content: res.text })
  return { reply: res.text, tools: [...new Set(toolsSeen)], handoff: session.state.paused, cost: res.estimatedCostUsd }
}

// ── 3. HTTP server ──
const HTML = /* html */ `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>WhatsApp Sim — ${manifest.name}</title>
<style>
  :root{--wa-green:#075e54;--wa-light:#dcf8c6;--wa-bg:#e5ddd5}
  *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  body{margin:0;background:#111;display:flex;justify-content:center;align-items:center;height:100vh}
  .phone{width:420px;max-width:100%;height:92vh;display:flex;flex-direction:column;background:var(--wa-bg);border-radius:14px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.5)}
  header{background:var(--wa-green);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px}
  header .avatar{width:38px;height:38px;border-radius:50%;background:#fff3;display:flex;align-items:center;justify-content:center;font-weight:700}
  header .meta{flex:1}.header .name{font-weight:600}header small{opacity:.8}
  header button{background:#ffffff22;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}
  #feed{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:6px;background-image:linear-gradient(rgba(229,221,213,.6),rgba(229,221,213,.6))}
  .row{display:flex}.row.user{justify-content:flex-end}
  .bubble{max-width:78%;padding:7px 10px;border-radius:8px;font-size:14px;white-space:pre-wrap;word-wrap:break-word;box-shadow:0 1px 1px rgba(0,0,0,.1)}
  .bubble.bot{background:#fff;border-top-left-radius:0}
  .bubble.user{background:var(--wa-light);border-top-right-radius:0}
  .chips{font-size:11px;color:#888;margin:0 6px 4px}
  .banner{align-self:center;background:#ffe9a8;color:#7a5b00;font-size:12px;padding:4px 10px;border-radius:10px;margin:4px 0}
  .typing{font-style:italic;color:#888}
  footer{display:flex;gap:8px;padding:10px;background:#f0f0f0;align-items:center}
  footer input[type=text]{flex:1;padding:10px 12px;border:1px solid #ccc;border-radius:20px;font-size:14px}
  footer button{background:var(--wa-green);color:#fff;border:0;width:42px;height:42px;border-radius:50%;cursor:pointer;font-size:18px}
  footer label{font-size:12px;color:#555;display:flex;align-items:center;gap:4px;cursor:pointer}
</style></head><body>
<div class="phone">
  <header>
    <div class="avatar">AA</div>
    <div class="meta"><div class="name">${manifest.name}</div><small id="status">online · simulador</small></div>
    <button id="reset">Reset</button>
  </header>
  <div id="feed"></div>
  <footer>
    <label><input type="checkbox" id="media"/>📎 foto</label>
    <input type="text" id="msg" placeholder="Mensagem" autocomplete="off"/>
    <button id="send">➤</button>
  </footer>
</div>
<script>
  const feed=document.getElementById('feed'),msg=document.getElementById('msg'),send=document.getElementById('send');
  const mediaChk=document.getElementById('media'),statusEl=document.getElementById('status');
  let sessionId=crypto.randomUUID(), busy=false;
  function bubble(text,who){const r=document.createElement('div');r.className='row '+who;const b=document.createElement('div');b.className='bubble '+who;b.textContent=text;r.appendChild(b);feed.appendChild(r);feed.scrollTop=feed.scrollHeight;return b;}
  function chips(text){const c=document.createElement('div');c.className='chips';c.textContent=text;feed.appendChild(c);feed.scrollTop=feed.scrollHeight;}
  function banner(text){const c=document.createElement('div');c.className='banner';c.textContent=text;feed.appendChild(c);feed.scrollTop=feed.scrollHeight;}
  async function sendMsg(){
    const text=msg.value.trim(); if(!text||busy) return; busy=true;
    const withMedia=mediaChk.checked; mediaChk.checked=false;
    bubble(text+(withMedia?' 📎':''),'user'); msg.value='';
    const t=bubble('…','bot'); t.classList.add('typing');
    try{
      const r=await fetch('/api/message',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId,text,media:withMedia})});
      const data=await r.json();
      t.remove();
      if(data.error){bubble('[erro] '+data.error,'bot');}
      else{
        bubble(data.reply,'bot');
        if(data.tools&&data.tools.length) chips('🔧 '+data.tools.join(', '));
        if(data.handoff){banner('⚑ atendimento transferido para humano (agente pausado)');statusEl.textContent='pausado · handoff';}
      }
    }catch(e){t.remove();bubble('[falha de rede] '+e,'bot');}
    busy=false; msg.focus();
  }
  send.onclick=sendMsg;
  msg.addEventListener('keydown',e=>{if(e.key==='Enter')sendMsg();});
  document.getElementById('reset').onclick=async()=>{
    const reset=document.getElementById('reset'); reset.disabled=true;
    try{ await fetch('/api/reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId})}); }catch(e){}
    // brand-new session id → servidor cria uma sessão vazia do zero (sem histórico, sem dados)
    sessionId=crypto.randomUUID(); feed.innerHTML=''; statusEl.textContent='online · simulador'; busy=false;
    bubble('Conversa reiniciada — memória do agente zerada. Manda uma mensagem 👋','bot');
    reset.disabled=false; msg.focus();
  };
  bubble('Oi! Sou o simulador da ${manifest.name}. Teste os fluxos: cotação, boleto/2ª via, sinistro, FAQ… 👋','bot');
</script></body></html>`

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    if (req.method === 'GET' && url.pathname === '/') {
      return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    if (req.method === 'POST' && url.pathname === '/api/message') {
      try {
        const { sessionId, text, media } = (await req.json()) as { sessionId?: string; text?: string; media?: boolean }
        if (!sessionId || typeof text !== 'string') return Response.json({ error: 'sessionId e text são obrigatórios' }, { status: 400 })
        const out = await handleMessage(sessionId, text, Boolean(media))
        return Response.json(out)
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 })
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/reset') {
      try {
        const { sessionId } = (await req.json()) as { sessionId?: string }
        // Wipe the agent's entire memory for this chat: conversation history,
        // per-session state/metadata (lead, veículo, CPF, validação financeira,
        // sinistro) and handoff/pause flag — tudo vive na Session, então deletar zera.
        const existed = sessionId ? sessions.delete(sessionId) : false
        __resetSgaState() // limpa token SGA cacheado + circuit breaker (estado global)
        console.log(`🔄 reset: sessão ${sessionId ?? '?'} ${existed ? 'limpa' : '(já vazia)'} — memória do agente zerada`)
        return Response.json({ ok: true, cleared: existed })
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 })
      }
    }
    return new Response('Not found', { status: 404 })
  },
})

console.log(`\n🟢 Simulador WhatsApp de [${agentSlug}] rodando em: http://localhost:${server.port}`)
console.log('   Abra no navegador e teste os fluxos. Ctrl+C para parar.\n')
