# M1 — Integração (SGA + CRM) & Roteamento por Intenção

> **Fase 1 — 1º módulo crítico do onboarding.** Status: implementado em código (mock-first para CRM).

## Spec

**Objetivo.** Dar ao agente (a) a camada de integração que alimenta a IA e as rotinas de gestão (SGA já pronto + CRM mock-first) e (b) a inteligência de **roteamento por intenção**: identificar o que a pessoa quer **antes** de pedir dados ou transferir, usando contexto (ex.: placa → veículo/contrato/unidade) e sem menu numérico rígido.

**Arquitetura.** 1 agente orquestrador (`level: orchestrator`) + módulos de tools. Roteamento vive no `prompts/system.md` (seção 0). Sem N deploys.

**Integração SGA** (pronto): 6 tools em `src/core/plugins.ts` (`tool_sga_*`) sobre `src/services/SgaClient.ts`, contrato `spec/sga.openapi.json`. Circuit breaker + handoff em falha.

**Integração CRM** (mock-first):
- `src/services/CrmClient.ts` — espelha o padrão do `SgaClient` (erro tipado, circuit breaker, timeout, bearer). Métodos: `getContactByPhone`, `upsertLead`, `logInteraction`.
- Contrato placeholder: `spec/crm.openapi.json` (substituir quando Lucas enviar a doc real).
- Tools: `tool_crm_get_contact`, `tool_crm_upsert_lead`, `tool_crm_log_interaction` (registradas sob o plugin `custom.crm`).
- Config: `CRM_BASE_URL`, `CRM_BEARER_TOKEN`, `CRM_TIMEOUT_MS`, `CRM_CIRCUIT_*` (todos opcionais com default — mock-first).

**Roteamento por intenção** (`system.md` seção 0): classifica em `{cotacao_comercial, financeiro_cobranca, sinistro, associado_faq, humano}`; intenção antes de transferência; sem menu rígido; placa → inferir veículo/unidade; múltiplas intenções → priorizar cancelamento/humano.

**Fora de escopo do M1.** Régua de cobrança (M3), qualificação avançada de lead/recuperação (M5), placa→unidade real via SGA (M2), ingestão de Q&A (M4).

## Tasks

- [x] `CrmClient.ts` mock-first (espelha SgaClient).
- [x] `spec/crm.openapi.json` placeholder.
- [x] Tools CRM + `withCrmFailureHandoff` em `plugins.ts` + registro em `getActiveTools` sob `custom.crm`.
- [x] Config CRM (`crmBaseUrl`/timeout/circuit) em `core/config.ts`.
- [x] Manifest `level: orchestrator` + plugin `custom.crm` (`requiredEnv: []` enquanto mock).
- [x] Seção 0 de roteamento por intenção no `system.md` + uso de CRM no fluxo comercial.
- [x] `tests/intent-routing.test.ts` (contrato do prompt) + `tests/crm-tools.test.ts` (tools, offline).
- [ ] Trocar mock do `CrmClient` pelo CRM real (depende da doc do Lucas).
- [ ] Declarar `CRM_BASE_URL`/`CRM_BEARER_TOKEN` em `requiredEnv` ao integrar real.
- [ ] Implementar placa→unidade responsável real (coordenar com M2).

## Dev Loop

Segue `../DEV-LOOP.md`:
1. Teste offline: `crm-tools.test.ts` (tools), `intent-routing.test.ts` (contrato do prompt).
2. UAT: `simulate-agent.ts` — confirmar que cada uma das 5 frentes é roteada corretamente sem menu rígido, e que `tool_crm_upsert_lead`/`log_interaction` disparam no fluxo comercial.
3. `bun test` + `bun run lint` verdes.
