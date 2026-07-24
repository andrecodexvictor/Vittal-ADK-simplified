# Prazos acordados — AprovaAuto (acordo final de datas)

> Fechado com **Jaíne Machado** em 24/07/2026 (12:06). Estas datas são o **compromisso de entrega por frente** — ao ler o `PROGRESS.md`, priorize sempre a frente com a data mais próxima que ainda tenha pendência.

| Entrega | Data acordada | Agente/instância | Status em 24/07 |
|---|---|---|---|
| **Gestão Financeira e Cobrança** | **06/08/2026** | `aprovauto-financeiro` | Código+deploy+régua dry-run prontos; falta número WhatsApp, homologar régua, teste 2ª via com CPF+placa reais |
| **Atendimento ao Associado** | **10/08/2026** | `aprovauto-ai` (maestro) | No ar (557781014643); falta fase 4 (prompt de direcionamento) + gate 4.2 quando os números existirem |
| **Sinistro** | **13/08/2026** | `aprovauto-sinistro` | Agente+follow-up no ar em dry-run; falta número WhatsApp, homologação, validar com protocolo real (depto SGA código 0) |
| **Comercial + CRM** | **18/08/2026** | `aprovauto-comercial` | Agente+recovery no ar em dry-run, fluxo CRM v1 (mock); falta número WhatsApp, doc do CRM real (Lucas), definição do pagamento da adesão |

## Regras de foco para o agente

1. **Ordem de prioridade = ordem das datas**: financeiro (06/08) → associado (10/08) → sinistro (13/08) → comercial (18/08).
2. Toda sessão de trabalho deve perguntar: *o que destrava a entrega mais próxima?* Bloqueios externos (números WhatsApp, doc CRM, homologações) devem ser **cobrados/escalados com antecedência**, não esperados — cite a data acordada ao cobrar.
3. A ativação de cada número leva ~5 min (2 env vars + webhook + redeploy) — o risco dos prazos está nos **bloqueios externos**, não no código. Sinalizar no ClickUp qualquer bloqueio que ameace uma data com ≥3 dias úteis de antecedência.
4. Datas dependentes: a fase 4 do associado (10/08) pressupõe os números das outras frentes existindo — se os números não chegarem até ~05/08, escalar imediatamente.
