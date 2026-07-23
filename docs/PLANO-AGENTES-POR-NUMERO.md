# Plano — AprovaAuto: um agente por número

> Gerado em 2026-07-22 · Execução rastreada em [`PROGRESS.md`](../PROGRESS.md) · Padrão de referência: agente financeiro (já no ar)
> Cada frente do ClickUp vira um agente WhatsApp dedicado, com número, host, prompt, ferramentas e memória próprios — mesmo repo/core (`src/`), mesma imagem Docker.

## 1. Mapa: frente → agente → número

| Frente (ClickUp) | Agente | Host | Número | Ferramentas (allowlist) |
|---|---|---|---|---|
| Atendimento ao Associado ([86aj5ygwy](https://app.clickup.com/t/86aj5ygwy)) | `aprovauto-ai` → **recepção** | aprovauto.vittalweb.com | **557781014643** (ativo) | FAQ/RAG + handoff + direcionamento por intenção |
| Atendimento comercial ([86aj5yj4j](https://app.clickup.com/t/86aj5yj4j)) | `aprovauto-comercial` | aprovauto-com.vittalweb.com | 🔒 novo (cliente) | `tool_sga_search_vehicle`, `tool_sga_simulate_quote`, `tool_sga_list_products`, `crm_get_contact`, `crm_upsert_lead`, `crm_log_interaction`, `human_handoff` |
| Atendimento de Sinistro ([86aj5yej0](https://app.clickup.com/t/86aj5yej0)) | `aprovauto-sinistro` | aprovauto-sin.vittalweb.com | 🔒 novo (cliente) | `tool_sga_create_claim`, `tool_sga_upload_claim_document`, `tool_sga_get_claim_status`, `tool_sga_search_vehicle`, `human_handoff` |
| Gestão financeira ([86aj5yfzj](https://app.clickup.com/t/86aj5yfzj)) | `aprovauto-financeiro` ✅ **pronto** | aprovauto-fin.vittalweb.com | 🔒 novo (cliente) | `tool_sga_get_financial_invoice`, `human_handoff` + régua de cobrança (schedule 9h BRT, dry-run) |
| Integração SGA/CRM ([86aj5yhja](https://app.clickup.com/t/86aj5yhja)) | transversal (core `src/`) | — | — | Já em teste interno; CRM em mock até a doc do Lucas |

## 2. Decisões de arquitetura

1. **Mesmo repo, uma instância por agente** *(revisado em 2026-07-23 para evitar conflitos de contexto)* — cada agente tem seu próprio compose (`docker-compose.<agente>.yml`, root = maestro `aprovauto-ai`), virando um app Dokploy próprio com imagem própria, commitado e deployado **individualmente**; `AGENT_SLUG` + prefixos de env (`FIN_`/`COM_`/`SIN_`) distinguem cada um. Os agentes se relacionam com o maestro pelo backbone comum: RabbitMQ (`vittal.messages`) + Vittal Hub.
2. **Allowlist de ferramentas por manifest** (`config.tools` no plugin `custom.sga` — mecanismo já no core): cada número só executa o que é da sua frente. CRM só existe no comercial.
3. **Transição sem quebra:** a recepção (`aprovauto-ai`) mantém TODAS as ferramentas até os 3 números novos existirem e serem validados. Cortar as tools transacionais da recepção é um **gate explícito** (fase 4.2) — nunca automático.
4. **Memória separada por agente no Vittal Hub** (uma `api_key`/linha em `ai_agents` por agente) — conversas não se misturam entre frentes.
5. **Webhook por agente**: `https://aprovauto-<frente>.vittalweb.com/webhook`, com `WEBHOOK_SECRET` = token da instância UAZAPI correspondente.
6. **Pix**: a API Hinova não tem Pix nativo — os agentes enviam PDF + linha digitável, e Pix copia-e-cola apenas quando a fatura trouxer o dado.
7. **Renegociação** (financeiro) v1 = handoff humano.

## 3. Fases

| # | Fase | Entregável | Status |
|---|------|-----------|--------|
| 1 | **aprovauto-comercial** — scaffold (manifest allowlist + CRM, prompt de vendas/qualificação, `.env.example` COM_, FAQ comercial, testes) | `agents/aprovauto-comercial/whatsapp/` com testes verdes | ⬜ |
| 2 | **aprovauto-sinistro** — scaffold (allowlist sinistro, prompt empático com coleta guiada + docs um a um + protocolo/48h, `.env.example` SIN_, FAQ, testes; `FEATURE_PROCESSAR_IMAGEM=true`) | `agents/aprovauto-sinistro/whatsapp/` com testes verdes | ⬜ |
| 3 | **Infra** — 2 serviços novos no compose (hosts aprovauto-com/aprovauto-sin, overrides COM_*/SIN_* com placeholder), registro no Hub, env Dokploy, deploy, `/health` 200 c/ cert | 4 containers no ar | ⬜ |
| 4 | **Recepção** — prompt do `aprovauto-ai` passa a direcionar (cotação→comercial, sinistro→sinistro, boleto→financeiro; só divulga números existentes) · 4.2 gate: cortar tools transacionais da recepção | Prompt atualizado; gate aprovado | ⬜ |
| 5 | **Ativação por número** (por instância nova): preencher `<PREFIXO>_WEBHOOK_SECRET`/`<PREFIXO>_UAZAPI_TOKEN` no Dokploy + webhook (evento `messages`) + redeploy + probes E2E (auth, saudação própria, fluxo principal, direcionamento cruzado, handoff) | Cada número validado E2E | 🔒 bloqueado |
| 6 | **Confirmação** — ClickUp (4 tasks), PROGRESS.md, memória | Registro completo | ⬜ |

**Já concluído (sprint de 22/07):** agente financeiro completo — scaffold, allowlist, prompt de cobrança suave, Hub (`sk-aprovauto-financeiro-v1-…`), serviço no ar (`aprovauto-fin.vittalweb.com/health` 200), régua validada com dados reais do SGA (15 elegíveis/0 envios) e agendada (Dokploy `LNQa0xk6sUPtPEltojFLy`, 9h BRT, dry-run). Commits `332b829`, `9c2016c`, `0f15889`.

## 4. Bloqueios externos

| Bloqueio | Destrava | Responsável |
|---|---|---|
| **3 números de WhatsApp novos** (comercial, sinistro, financeiro) — instâncias UAZAPI | Fase 5 (ativação; ~5 min por número) | Cliente/infra |
| **Homologação da régua** (textos/estágios finais) | Tirar `BILLING_DRY_RUN` (cobrança real) | Cliente + Vittal |
| CPF+placa reais de associado para teste | Validação E2E da 2ª via | Cliente |
| Doc do CRM real (Lucas) | Tirar `CRM_MOCK` no comercial | Cliente |

## 5. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Associado chama o número "errado" | Todos os prompts têm "fora-de-escopo → direciona" cruzado entre os 4 números |
| Custo/manutenção de 4 serviços | Mesma imagem/core; diff por agente é só manifest+prompt+env. Anti-spam ativo em cada um |
| Conversa duplicada entre números | Aceito na v1 (memórias separadas por agente no Hub); visão unificada no Hub é evolução futura |
| Corte prematuro de tools da recepção | Gate explícito na fase 4.2, só após todos os números validados |

## 6. Rollback
Fases 1–3 são aditivas (pastas novas + serviços novos): reverter = `git revert` + remover serviços do compose. A recepção nunca perde capacidade antes do gate 4.2, então o atendimento atual não corre risco durante a execução.
