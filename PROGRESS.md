# PROGRESS — AprovaAuto: um agente por número

> ⏰ **PRAZOS ACORDADOS (ler primeiro): [`docs/PRAZOS-ACORDADOS.md`](docs/PRAZOS-ACORDADOS.md)** — financeiro **06/08** · associado **10/08** · sinistro **13/08** · comercial+CRM **18/08**. Priorize sempre a data mais próxima com pendência.
> **Plano completo (commitado):** [`docs/PLANO-AGENTES-POR-NUMERO.md`](docs/PLANO-AGENTES-POR-NUMERO.md) · PREVC: **concluído** (workflow agente-financeiro fechado em 23/07)
> ClickUp: as 4 frentes em "fazendo" · Última atualização: 2026-07-24

## Repos por instância (versionamento a partir de 2026-07-23)

| Instância | Repo GitHub | Working copy local |
|---|---|---|
| maestro (aprovauto-ai) | [VittalWeb/Aprovauto-ai](https://github.com/VittalWeb/Aprovauto-ai) | este repo (`Vittal-ADK-simplified`) |
| aprovauto-financeiro | [VittalWeb/Aprovauto-Financeiro-ai](https://github.com/VittalWeb/Aprovauto-Financeiro-ai) | `Desktop/Aprovauto-Financeiro-ai` |
| aprovauto-comercial | [VittalWeb/Aprovauto-comercial-ai](https://github.com/VittalWeb/Aprovauto-comercial-ai) | `Desktop/Aprovauto-comercial-ai` |
| aprovauto-sinistro | [VittalWeb/Aprovauto-sinistro-ai](https://github.com/VittalWeb/Aprovauto-sinistro-ai) | `Desktop/Aprovauto-sinistro-ai` |

Cada repo = core ADK (`src/`) + `agents/<slug>/` + `docker-compose.yml` próprio → app Dokploy próprio, commit/deploy individuais. Evolução do core: aplicar no maestro e replicar nos repos das instâncias.

## Visão

| Agente | Frente (ClickUp) | Host | Número | Status |
|---|---|---|---|---|
| aprovauto-ai | Atendimento ao Associado (recepção) | aprovauto.vittalweb.com | 557781014643 | ✅ no ar (hoje com todas as tools; vira recepção pura no gate) |
| aprovauto-financeiro | Gestão financeira | aprovauto-fin.vittalweb.com | 🔒 aguarda número | ✅ código+deploy+régua dry-run prontos |
| aprovauto-comercial | Atendimento comercial | aprovauto-com.vittalweb.com | 🔒 aguarda número | ✅ scaffold + testes + compose (falta Hub+deploy) |
| aprovauto-sinistro | Atendimento de Sinistro | aprovauto-sin.vittalweb.com | 🔒 aguarda número | ✅ scaffold + testes + compose (falta Hub+deploy) |

## Próximos passos
1. ~~Fase 1: scaffold `aprovauto-comercial`~~ ✅ (allowlist SGA cotação + CRM mock, prompt de vendas, FAQ, 5 testes verdes)
2. ~~Fase 2: scaffold `aprovauto-sinistro`~~ ✅ (allowlist sinistro, prompt empático + docs um a um + 48h, FAQ, 5 testes verdes)
3. ~~Fase 3~~ ✅ **concluída em 2026-07-23**: 4 apps Dokploy no projeto `aprovauto`, um por repo — maestro `1AYQiHs3QLPwX4J8f5gCG`, financeiro `KGMslLjLpJtzG3wOpRPtg`, comercial `ClmZj-117noeiFcdhtLWT`, sinistro `PMXJk_Bp4dKAc7JlVGElk`. **4 containers no ar com `/health` 200** (aprovauto/aprovauto-fin/aprovauto-com/aprovauto-sin.vittalweb.com). Hub: comercial `sk-aprovauto-comercial-b7a3…` e sinistro `sk-aprovauto-sinistro-402d…` registrados. Schedules (dry-run, BRT): régua 9h (migrada p/ app financeiro, `Va13c4ZDoaFqHh5UM1GU8`), recuperação 10h (`YTM1JUL0vmTJc4j0nYECX`), follow-up 8h/14h/20h (`J89wzZzy6_9XNSaD8EarO`)
4. Fase 4: prompt de direcionamento na recepção (quando os números existirem) · gate 4.2 explícito
- Em paralelo, quando chegar qualquer número novo: ativação em ~5 min (tokens + webhook) — fase 5

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
1. Mesmo repo; **uma instância por agente** (2026-07-23): compose próprio (`docker-compose.<agente>.yml`) + app Dokploy + imagem próprios, deploy individual; `AGENT_SLUG` distingue; FIN_*/COM_*/SIN_* com placeholder até os números existirem. Comunicação inter-agentes: RabbitMQ (`vittal.messages`) + Vittal Hub, maestro = aprovauto-ai.
2. Financeiro é dono da régua: billing-runner `--agent aprovauto-financeiro` (schedule roda no container dele).
3. **Allowlist de tools** (`config.tools` no plugin custom.sga): o número de cobrança só expõe `tool_sga_get_financial_invoice` + `human_handoff` — não pode abrir sinistro/cotação.
4. Pix não é prometido (API Hinova não tem Pix nativo) — só se vier na fatura.
5. Renegociação v1 = handoff humano.
6. Roteamento por prompt (zero código novo no core do roteamento).
7. `SGA_TIMEOUT_MS=60000` no financeiro (varredura paginada da régua passa de 10s).

## Log
- 2026-07-23: **Entregáveis ClickUp por instância**: comercial ganhou `recovery-runner` (recuperação de oportunidades, CRM mock `/leads/open`, dry-run E2E ok — `5a06ccd`) e o **fluxo de negociação do CRM v1** (BPMN do cliente → `spec/CRM-FLOW.md`; lead com `vehicleCategory`/`associacao`/`vehicleValue`; caminhão→handoff; TOP >R$80mil; ativação 48h — `938d6ad`); sinistro ganhou `followup-runner` (pendências documentais via metadados do Hub, `docsReceived`/`pendingDocs` nas tools — `3c4f49c`). Ressalvas do cliente: caminhões fora da v1; pagamento da adesão difere entre Aprovauto/Conexão (em mudança — não prometer forma de pagamento).
- 2026-07-23: Split em 4 repos (VittalWeb) — ver tabela acima. Maestro enxuto (`6bc1a9b`).
- 2026-07-22: Plano+workflow PREVC (LARGE, autônomo), skills `aprovauto-agent-ops`/`aprovauto-cobranca`. Fases 2, 4 e 5-parcial concluídas e verificadas em produção. Commit `332b829`.
