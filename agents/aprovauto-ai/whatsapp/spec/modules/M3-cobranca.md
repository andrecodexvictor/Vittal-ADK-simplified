# M3 — Gestão Financeira e Cobrança Inteligente

> Fase 2. Parte reativa (2ª via) já existe; falta a **cobrança ativa (régua)**.

## Spec

**Objetivo.** Reduzir inadimplência e agilizar o financeiro mantendo bom relacionamento, com **tom suave** (onboarding) — debriefing §2.

**Já implementado (reativo, sob demanda):**
- `tool_sga_get_financial_invoice` — 2ª via somente após validar **CPF + placa do contrato ativo** (LGPD). Divergência → nega exposição e transborda ao financeiro.
- Fluxo 4.2 no `system.md`: oferece PDF do boleto, linha digitável ou Pix copia-e-cola só se autorizado.

**A adicionar — Cobrança ativa (proativa):**
A IA é reativa (webhook→RabbitMQ). A régua é proativa → **worker/cron separado**.
- `scripts/billing-runner.ts` (novo): disparado por **Dokploy schedule** (`schedule-create`) / cron.
- Lê inadimplentes no SGA (`situacao_financeira: INADIMPLENTE` / boletos `codigo_situacao_boleto = 2 ABERTO`).
- **Só dispara lembrete para quem tem boleto em aberto.**
- Respeita a **régua de cobrança** já existente da empresa (estados: preventivo antes do vencimento; corretivo após).
- **Janela D+1:** pagamento é processado manualmente e a baixa ocorre no dia seguinte → não cobrar quem pagou recentemente (evitar cobrança indevida). Aplicar carência configurável (ex.: ignorar vencidos há ≤ 1–2 dias úteis).
- Publica a mensagem suave via `RabbitMQPublisher` (mesma infra de saída do agente).
- Idempotência: não enviar 2 lembretes do mesmo estágio no mesmo dia (registrar no metadata/hub).

**Config nova esperada:** `BILLING_*` (cron, carência D+1, estágios da régua, template suave). Definir junto com a régua oficial.

**Fora de escopo.** Emissão de boleto novo (debriefing cita emissão automatizada como evolução; priorizar 2ª via + lembrete).

**Endpoints reais Hinova usados:** `POST /listar/boleto-associado/periodo` (varredura paginada, traz `nome_associado`, `cpf`, `celular`, `quantidade_dias_vencidos`, `linha_digitavel`, `link_boleto`), `GET /buscar/situacao-financeira-veiculo/:placa` (ADIMPLENTE/INADIMPLENTE), `POST /alterar/vencimento-boleto` (renegociação). **Não há PIX nativo**; lembrete usa link do boleto + linha digitável (e Pix só se a resposta trouxer).

## Tasks

- [x] 2ª via reativa com LGPD (CPF + placa) — `tool_sga_get_financial_invoice` via `/listar/boleto/periodo`.
- [x] `scripts/billing-runner.ts` (worker) + leitura de boletos em aberto no SGA (paginado).
- [x] Régua: estágios `preventivo` (D-3) / `vencido_recente` (≤7d) / `vencido` + janela de carência D+1 (`BILLING_OVERDUE_GRACE_DAYS`).
- [x] Idempotência de disparo (1 lembrete por boleto+estágio/dia, cache em `.billing-cache/`).
- [x] Template de mensagem suave por estágio (revisar tom final com a Vittal).
- [x] Modo dry-run (`BILLING_DRY_RUN`/`--dry-run`/`--live`) para o gate do dia 60.
- [ ] Agendar no Dokploy (`schedule-create`) rodando `bun run scripts/billing-runner.ts --agent aprovauto-ai` 1x/dia.
- [ ] Confirmar `codigo_situacao_boleto` real de "ABERTO" (via `GET /listar/situacao-boleto/todos`) e ajustar `SGA_BOLETO_OPEN_STATUS_CODE`.
- [ ] Persistir métricas de inadimplência/idempotência no Hub (hoje cache local) — entrada do M6.

## Dev Loop

Segue `../DEV-LOOP.md` com adaptação para worker:
1. Teste offline do `billing-runner` com SGA mockado: dado um conjunto de boletos (aberto/recém-vencido/pago), assert quais geram lembrete (respeitando D+1 e idempotência).
2. Dry-run agendado (sem publicar) validando seleção antes do disparo real — gate do dia 60.
3. `bun test` + `bun run lint`.
