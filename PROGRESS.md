# PROGRESS — Agente Financeiro AprovaAuto

> Plano: `.context/plans/agente-financeiro-aprovauto.md` · Workflow PREVC: fase **E** (autônomo)
> ClickUp: [Gestão financeira](https://app.clickup.com/t/86aj5yfzj) · Última atualização: 2026-07-22

## Objetivo
Separar o agente único em dois: **aprovauto-financeiro** (2ª via LGPD, boletos, régua ativa, renegociação→handoff, número próprio) e **aprovauto-ai** (comercial/sinistro/FAQ, direciona financeiro).

## Fases

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 (P) | Desenho da separação + decisões + bloqueios | ✅ concluída (ver plano) |
| 2 (E) | Scaffold `agents/aprovauto-financeiro/whatsapp` (manifest, prompt, env, knowledge, testes) | 🔄 em andamento |
| 3 (E) | Roteamento no aprovauto-ai (financeiro → número novo, com fallback) | ⬜ |
| 4 (E) | Régua ativa sob o financeiro + schedule Dokploy (dry-run) | ⬜ |
| 5 (V) | Hub + serviço no compose/Dokploy + webhook + probes E2E | ⬜ |
| 6 (C) | ClickUp, memória, documentação | ⬜ |

## Bloqueios externos
- [ ] **Nova instância UAZAPI** (número WhatsApp do financeiro) — cliente/infra. Sem ela, fase 5 fica com placeholder.
- [ ] **Régua oficial homologada** (estágios/textos finais) — gate para tirar `BILLING_DRY_RUN`.
- [ ] Teste 2ª via com **CPF+placa reais** de associado (rotas SGA já liberadas em 22/07).

## Decisões
1. Mesmo repo/imagem Docker; agentes diferem por manifest+prompt+env (`AGENT_SLUG`), 2 serviços no compose.
2. Financeiro é dono da régua: billing-runner roda `--agent aprovauto-financeiro`.
3. Pix não é prometido (API Hinova não tem Pix nativo) — só se vier na fatura.
4. Renegociação v1 = handoff humano (rota `/alterar/vencimento-boleto` fica para v2).
5. Roteamento por prompt (sem código novo no core): aprovauto-ai divulga o número financeiro quando existir.

## Log
- 2026-07-22: Plano criado, workflow PREVC iniciado (LARGE, autônomo por bug no link do plano), skills `aprovauto-agent-ops` e `aprovauto-cobranca` criadas. Início da fase 2.
