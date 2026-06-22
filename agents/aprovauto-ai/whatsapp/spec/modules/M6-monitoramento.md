# M6 — Monitoramento e Evolução Contínua

> Transversal. Relação de longo prazo com suporte contínuo (onboarding).

## Spec

**Objetivo.** Garantir melhoria contínua: revisar conversas, sugerir melhorias de saudação/atendimento, corrigir falhas (botão que não carrega, resposta inadequada, contexto perdido) e operar os **gates de teste contínuo dos dias 60 e 90** (debriefing §7 + onboarding).

**Insumos:**
- Logs de execução do Vittal Hub (steps, tools, custo, handoff) já gravados pelo `ProcessMessage`.
- Cenários de UAT do `scripts/simulate-agent.ts` + `spec/WHATSAPP_UAT_STRESS_TESTS.md`.
- Feedback dos parceiros (Vittal/AprovaAuto) nos primeiros meses.

**Atividades:**
1. **Revisão periódica de conversas** — amostragem de execuções reais; classificar falhas e abrir itens de ajuste (prompt, RAG, tool).
2. **Métricas** — % de conversas resolvidas sem humano, taxa de handoff, vazamentos LGPD (meta zero), tempo de resposta, inadimplência (entrada de M3), conversão de lead (entrada de M5).
3. **Gates 60/90** — ver `../ROADMAP.md`. Dia 60: testes assistidos pré go-live. Dia 90: otimização/evolução.
4. **Pré-requisito do gate 60:** reconciliar `SgaClient` ↔ `simulate-agent.ts` (ver `../DEV-LOOP.md`) para o simulador rodar fim-a-fim.
5. **Backlog de evolução** — expansão futura de módulos/integrações com calendário de evolução.

## Tasks

- [ ] Rotina de amostragem/revisão de conversas do Hub.
- [ ] Painel/relatório de métricas (resolvidas, handoff, LGPD, conversão, inadimplência).
- [ ] Checklist do gate do dia 60 e do dia 90.
- [ ] Reconciliar SgaClient ↔ simulador (destrava UAT fim-a-fim).
- [ ] Processo de feedback dos parceiros → backlog priorizado.

## Dev Loop

Segue `../DEV-LOOP.md`, com o M6 fechando o ciclo: achados de UAT e de produção viram tarefas dos módulos correspondentes. Cada release passa pela bateria do `simulate-agent.ts` (incl. cenários de segurança 6.x) antes de subir.
