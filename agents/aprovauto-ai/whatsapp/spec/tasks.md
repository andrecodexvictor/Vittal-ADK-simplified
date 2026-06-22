# Task List — AprovaAuto AI

> Visão modular completa em `ROADMAP.md` e `modules/M1..M6-*.md`. Abaixo: base SGA + Fase 1 (M1).

## Fase 1 — Integração & Roteamento (M1)
- [x] Manifest `orchestrator` + plugin `custom.crm`.
- [x] `CrmClient` mock-first + contrato `crm.openapi.json`.
- [x] Tools CRM (`get_contact`/`upsert_lead`/`log_interaction`) + `withCrmFailureHandoff`.
- [x] Config CRM (`crmBaseUrl`/timeout/circuit).
- [x] Seção 0 de roteamento por intenção no `system.md`.
- [x] `tests/intent-routing.test.ts` + `tests/crm-tools.test.ts`.
- [ ] Trocar mock CRM pelo real (doc do Lucas) + `requiredEnv` real.

## Base SGA (pré-existente)
- [x] Manifest transacional configurado.
- [x] Prompt pt-BR com fluxos de cotação, financeiro e sinistro.
- [x] Contrato placeholder OpenAPI SGA em `spec/sga.openapi.json`.
- [x] Tools SGA registradas no core.
- [x] Estado progressivo salvo no metadata do Vittal Hub.
- [x] Upload de documento via `multipart/form-data`.
- [x] Regra LGPD CPF + placa para financeiro.
- [x] Circuit breaker e handoff em falhas SGA.
- [x] Testes offline das tools críticas.
- [ ] Substituir placeholder pelo contrato oficial SGA.
- [ ] Preencher credenciais reais no `.env`.
- [ ] Rodar `bun test agents/aprovauto-ai/whatsapp/tests`.
- [ ] Rodar `bun run dev --agent aprovauto-ai`.
