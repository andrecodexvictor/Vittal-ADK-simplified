# aprovauto-agent-ops — criar/operar agentes neste ADK

Use quando: criar um novo agente, fazer deploy, ligar um número WhatsApp, depurar webhook.

## Anatomia de um agente
`agents/<slug>/<canal>/` com: `agent.manifest.json` (fonte de verdade: level/capabilities/plugins/publisher),
`prompts/system.md`, `.env` (gitignored) + `.env.example`, `knowledge/` (RAG), `tests/`.
O core `src/` é compartilhado — nunca duplicar; diferenças vivem no manifest/prompt/env.

## Criar agente
- `bun run create-agent "Nome" "Descrição" "whatsapp"` (copia `templates/agent/`), ou copiar manualmente.
- Rodar: `bun run dev --agent <slug>`; testes: `bun test agents/<slug>/whatsapp/tests`.

## Regras que já causaram incidente (não redescobrir)
1. **`WEBHOOK_SECRET` = token da instância UAZAPI.** A UAZAPI manda o token no payload; `server.ts` valida contra `config.webhookSecret`.
2. **Dokploy: `redeploy` NÃO puxa git** — só rebuilda o clone velho em `/etc/dokploy/compose/<app>/code`. Para pegar commit novo use **deploy** (compose-deploy).
3. **Roteamento Traefik vem dos labels do `docker-compose.yml`** (hardcoded), não do sistema de domínios do Dokploy.
4. **Env do Dokploy trata `#` como comentário** — valores com `#` (ex.: SGA_SENHA) precisam de aspas.
5. **Hub**: cada agente precisa de linha própria em `ai_agents` (postgres `vittalhub`, container `hub-postgres-*`; coluna `api_key`). Sem isso: 401 e o agente perde memória de conversa (fallback local silencioso).
6. **Modelo**: `gpt-5.4-mini` (gpt-4o-mini não chamava tools). Provider já usa `max_completion_tokens`.
7. **Anti-spam** em `server.ts` (`isSpamming`): 10/min e 30/hora → mute 30min (envs `ANTISPAM_*`). Vale por processo.

## Verificação E2E padrão (após deploy)
`GET /health` 200 com cert válido → probe webhook com token errado (rejeita) e certo (processa) →
mensagem real → logs `Pipeline concluido` → conferir conversa gravada no Hub.
