# DEV-LOOP — Loop padrão de desenvolvimento (offline-first)

Todos os módulos do AprovaAuto são desenvolvidos com o mesmo ciclo goal-driven (CLAUDE.md §4). Este é o "loop" reusado por M1–M6.

## O ciclo (por capacidade/fluxo)

1. **Escreva o teste que falha** — em `agents/aprovauto-ai/whatsapp/tests/<modulo>.test.ts`, reproduza o fluxo desejado de forma **offline** (mock de `fetch` para SGA/CRM, sem rede, sem LLM). Veja `tests/agent.test.ts` e `tests/crm-tools.test.ts` como modelo (carregam o manifest real + `getActiveTools`, mockam `globalThis.fetch`, validam mapeamento, guardrails e estado).
2. **Implemente o mínimo** — a tool/cliente/seção de prompt necessária para o teste passar. Mudanças cirúrgicas; não refatore o que já funciona.
3. **Loop de UAT conversacional** — `bun run scripts/simulate-agent.ts --agent aprovauto-ai` roda o pipeline real (prompt + `getActiveTools` + tool-calling do OpenAI) com **LLM real** e integrações **mockadas deterministicamente**. Use para validar a parte que o teste offline não cobre: roteamento por intenção, fluência, não repetir perguntas, escolher a frente certa. Filtre cenários com `--only <id>`.
4. **Verde antes de fechar** — `bun test agents/aprovauto-ai/whatsapp/tests` e `bun run lint` devem passar.
5. **Registre no M6** — achados do UAT (botão que não carrega, resposta inadequada, contexto perdido) viram itens da próxima iteração (ver `modules/M6-monitoramento.md`).

## Comandos

```bash
bun test agents/aprovauto-ai/whatsapp/tests        # testes offline do agente
bun run scripts/simulate-agent.ts --agent aprovauto-ai            # UAT conversacional (LLM real)
bun run scripts/simulate-agent.ts --agent aprovauto-ai --only 2.1,3.3   # subset
bun run lint                                       # Biome
bun run dev --agent aprovauto-ai                   # sobe local (porta 3000) p/ webhook
```

## Tipos de teste por camada

| Camada | Como validar | Exemplo |
|---|---|---|
| Tool / cliente de integração | teste offline com `fetch` mockado | `crm-tools.test.ts`, `agent.test.ts` |
| Contrato de prompt (roteamento, guardrails) | teste offline lendo `system.md` | `intent-routing.test.ts` |
| Comportamento conversacional (LLM) | `simulate-agent.ts` (LLM real, integrações mock) | cenários 2.x/3.x/6.x |
| Regressão de segurança/LGPD | cenários 6.x do simulador + testes de divergência CPF/placa | `WHATSAPP_UAT_STRESS_TESTS.md` |

## Estado do harness (reconciliado)

O `src/services/SgaClient.ts` agora usa a **API Hinova SGA v2 real** (two-step auth, `__resetSgaState`, endpoints `/veiculo/buscar-por-permissao`, `/buscar/rateio-medio`, `/listar/boleto/periodo`, `/cadastrar/historico-atendimento-associado`, etc.), os mesmos que o `scripts/simulate-agent.ts` mocka — então o simulador roda fim-a-fim. Para o UAT com LLM real basta `OPENAI_API_KEY` válida no `.env` do agente.

Há também um **simulador WhatsApp interativo** (`scripts/wa-sim-server.ts`, estilo WaFlow): UI de chat no navegador que dirige o mesmo pipeline. Veja a seção abaixo.

## Simulador WhatsApp interativo (estilo WaFlow)

```bash
bun run scripts/wa-sim-server.ts --agent aprovauto-ai   # abre em http://localhost:3001
```
- UI de chat tipo WhatsApp; cada mensagem passa pelo pipeline real (system prompt + getActiveTools + tool-calling).
- SGA mockado deterministicamente (mesmo mock do `simulate-agent`); LLM real (usa `OPENAI_API_KEY` do `.env`).
- Botão "Reset" zera a conversa; mostra as tools chamadas e o estado de handoff por mensagem.
