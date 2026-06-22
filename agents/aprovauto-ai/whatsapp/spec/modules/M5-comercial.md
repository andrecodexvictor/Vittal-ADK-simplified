# M5 — Atendimento Comercial Inteligente para Leads

> Fase 3. Cotação existe; falta qualificação/recuperação via CRM.

## Spec

**Objetivo.** Atender leads (tráfego pago) 24/7, qualificar, simular/enviar cotações, aplicar gatilhos comerciais e direcionar leads qualificados ao consultor com **resumo completo**; recuperar oportunidades não convertidas (debriefing §5 + onboarding).

**Já implementado:**
- Cotação: `tool_sga_search_vehicle` (placa ou modelo) + `tool_sga_simulate_quote`. Fluxo 4.1 no `system.md`.
- Base CRM (M1): `tool_crm_get_contact`, `tool_crm_upsert_lead`, `tool_crm_log_interaction` (mock-first).
- Prompt já instrui: gatilho leve de urgência + `upsert_lead` (`stage: handoff_sales`) + `log_interaction` antes do `human_handoff` de vendas.

**A adicionar (Fase 3, depende do CRM real):**
1. **Qualificação inteligente** do lead de tráfego pago (interesse, veículo, urgência) gravada no CRM com `stage` evoluindo (`new`→`qualifying`→`qualified`→`handoff_sales`).
2. **Gatilhos de urgência/oferta** calibrados (sem pressionar) — diferencial competitivo no momento certo.
3. **Resumo estruturado → consultor**: handoff de vendas sempre acompanhado de `log_interaction` com resumo padronizado (veículo, valor simulado, objeções).
4. **Recuperação de oportunidade não convertida**: lead que não fechou → re-engajamento proativo (worker, reusa infra de M3) consultando CRM (`stage` aberto) — respeitando frequência e opt-out.
5. **Separação de canais** (onboarding): número comercial (captação) vs operacional (sinistro/serviços) — refletir `source` no CRM e, se necessário, instâncias UAZAPI distintas.

## Tasks

- [x] Cotação SGA (search + simulate).
- [x] Tools CRM (lead/log) mock-first.
- [x] Prompt: urgência leve + upsert_lead + log_interaction antes do handoff de vendas.
- [ ] Qualificação com evolução de `stage` no CRM real.
- [ ] Resumo estruturado padronizado para o consultor.
- [ ] Worker de recuperação de oportunidade (reusa infra de M3) + opt-out.
- [ ] Separação de canais comercial vs operacional (config/instâncias).

## Dev Loop

Segue `../DEV-LOOP.md`:
1. Teste offline: `upsert_lead`/`log_interaction` (já em `crm-tools.test.ts`); adicionar asserts de evolução de `stage`.
2. UAT (`simulate-agent.ts`): cenários `2.1`/`2.2`/`2.3`/`2.4` (cotação→lead pronto), validar que o resumo vai ao CRM antes do handoff.
3. `bun test` + `bun run lint`.
