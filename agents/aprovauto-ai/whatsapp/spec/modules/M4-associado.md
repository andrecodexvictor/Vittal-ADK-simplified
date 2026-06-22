# M4 — Atendimento Inteligente ao Associado

> Fase 2. RAG genérico existe; falta FAQ categorizado + ingestão da planilha de Q&A.

## Spec

**Objetivo.** Atendimento 24/7 humanizado ao associado, interpretando texto e áudio, centralizando dúvidas recorrentes, padronizando comunicação conforme a identidade da empresa e encaminhando para humano quando necessário (debriefing §3).

**Já implementado:**
- RAG local (`LangChainRag`) sobre `knowledge/aprovauto_faq.md` + cache `.rag-cache/embeddings.json`.
- Áudio (Whisper) e imagem (visão) no `ProcessMessage`.
- Handoff (`human_handoff`) para humano quando fora da base factual.
- Fluxo 4.5 (FAQ e fora de escopo) no `system.md`.

**A adicionar:**
1. **Categorização da FAQ** em três frentes — **sinistro / comercial / associado** (ação do grupo no onboarding). Estruturar `aprovauto_faq.md` (ou múltiplos arquivos) por categoria para recuperação mais precisa.
2. **Ingestão da planilha de Q&A da Jaine** — colunas de perguntas/respostas para treinamento. Pipeline: planilha → markdown categorizado em `knowledge/` → `bun run rag:vectorize --agent aprovauto-ai` (regenera o cache).
3. **Padronização de saudação/tom** — revisões periódicas (entrada do M6) ajustam saudação e atendimento conforme identidade da AprovaAuto.

**Limites.** IA não é 100% automatizada: áudio de baixa qualidade, ambiguidade forte → handoff. Não inventar resposta fora da base factual.

## Tasks

- [x] RAG local + cache de embeddings.
- [x] Áudio/imagem no pipeline.
- [ ] Reestruturar FAQ por categoria (sinistro/comercial/associado).
- [ ] Conversor planilha Q&A → markdown categorizado em `knowledge/`.
- [ ] Re-vetorizar e validar recuperação por categoria.
- [ ] Ajustes de saudação/tom conforme identidade (loop com M6).

## Dev Loop

Segue `../DEV-LOOP.md`:
1. Teste offline de recuperação RAG: perguntas-âncora por categoria retornam o chunk certo.
2. UAT (`simulate-agent.ts`): cenários `1.1` (horário), `1.3` (fora de escopo), `P2`/`P5`/`P6` (leigo/off-topic) — sem inventar, com handoff quando fora da base.
3. `bun test` + `bun run lint`.
