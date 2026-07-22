# PROGRESS — AprovaAuto: um agente por número

> Planos: `.context/plans/agentes-por-numero.md` (master) + `agente-financeiro-aprovauto.md` (padrão) · PREVC: fase **V**
> ClickUp: as 4 frentes em "fazendo" · Última atualização: 2026-07-22

## Visão

| Agente | Frente (ClickUp) | Host | Número | Status |
|---|---|---|---|---|
| aprovauto-ai | Atendimento ao Associado (recepção) | aprovauto.vittalweb.com | 557781014643 | ✅ no ar (hoje com todas as tools; vira recepção pura no gate) |
| aprovauto-financeiro | Gestão financeira | aprovauto-fin.vittalweb.com | 🔒 aguarda número | ✅ código+deploy+régua dry-run prontos |
| aprovauto-comercial | Atendimento comercial | aprovauto-com.vittalweb.com | 🔒 aguarda número | ⬜ fase 1 do plano master |
| aprovauto-sinistro | Atendimento de Sinistro | aprovauto-sin.vittalweb.com | 🔒 aguarda número | ⬜ fase 2 do plano master |

## Detalhe do financeiro (concluído nesta sprint)

### Objetivo
Separar o agente único em dois: **aprovauto-financeiro** (2ª via LGPD, boletos, régua ativa, renegociação→handoff, número próprio) e **aprovauto-ai** (comercial/sinistro/FAQ, direciona financeiro).

## Fases

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 (P) | Desenho da separação + decisões + bloqueios | ✅ |
| 2 (E) | Scaffold `agents/aprovauto-financeiro/whatsapp` (manifest c/ allowlist SGA, prompt cobrança suave, env, FAQ, testes) | ✅ commit `332b829` |
| 3 (E) | Roteamento no aprovauto-ai (divulgar número financeiro no fluxo 4.2) | ⏸️ adiado de propósito — só faz sentido quando o número financeiro existir |
| 4 (E) | Régua ativa sob o financeiro + schedule Dokploy (dry-run) | ✅ validada local E em produção (15 elegíveis/0 envios); schedule diário 9h BRT (`LNQa0xk6sUPtPEltojFLy`) |
| 5 (V) | Hub + serviço no compose + deploy + probes | ✅ parcial: Hub registrado (`sk-aprovauto-financeiro-v1-3f7c…`), container no ar, `https://aprovauto-fin.vittalweb.com/health` 200 c/ cert válido. **Falta só o webhook (bloqueado pelo número)** |
| 6 (C) | ClickUp, memória, documentação | ✅ desta rodada (repetir no gate final) |

## Bloqueios externos (impedem a conclusão total)
- [ ] **Nova instância UAZAPI** (número WhatsApp do financeiro). Quando existir:
  1. Preencher no env do Dokploy: `FIN_WEBHOOK_SECRET` e `FIN_UAZAPI_TOKEN` = token da instância; redeploy.
  2. Configurar webhook da instância → `https://aprovauto-fin.vittalweb.com/webhook` (evento `messages`).
  3. Fase 3: divulgar o número no prompt do aprovauto-ai.
- [ ] **Régua oficial homologada** (textos/estágios finais) — gate para `BILLING_DRY_RUN=false`.
- [ ] Teste 2ª via com **CPF+placa reais** de associado.

## Decisões
1. Mesmo repo/imagem Docker; 2 serviços no compose (`AGENT_SLUG` distingue); FIN_* com placeholder até o número existir.
2. Financeiro é dono da régua: billing-runner `--agent aprovauto-financeiro` (schedule roda no container dele).
3. **Allowlist de tools** (`config.tools` no plugin custom.sga): o número de cobrança só expõe `tool_sga_get_financial_invoice` + `human_handoff` — não pode abrir sinistro/cotação.
4. Pix não é prometido (API Hinova não tem Pix nativo) — só se vier na fatura.
5. Renegociação v1 = handoff humano.
6. Roteamento por prompt (zero código novo no core do roteamento).
7. `SGA_TIMEOUT_MS=60000` no financeiro (varredura paginada da régua passa de 10s).

## Log
- 2026-07-22: Plano+workflow PREVC (LARGE, autônomo), skills `aprovauto-agent-ops`/`aprovauto-cobranca`. Fases 2, 4 e 5-parcial concluídas e verificadas em produção. Commit `332b829`.
