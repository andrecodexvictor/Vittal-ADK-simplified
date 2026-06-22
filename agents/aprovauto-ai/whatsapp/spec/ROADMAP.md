# ROADMAP — AprovaAuto (implementação modular)

Origem: onboarding "Vittal Flow + AprovaAuto" (Jaine Machado / Lucas Cardozo). Projeto estruturado em módulos, com **testes contínuos nos dias 60 e 90** e **go-live em até 60 dias úteis**. A integração de sistemas é o **1º módulo crítico**.

## Módulos

| # | Módulo | Spec | Fase |
|---|--------|------|------|
| M1 | Integração (SGA + CRM) & Roteamento por intenção | `modules/M1-integracao-roteamento.md` | **Fase 1 ✅ (em código)** |
| M2 | Atendimento de Sinistro | `modules/M2-sinistro.md` | Fase 3 |
| M3 | Cobrança Inteligente (2ª via + régua ativa) | `modules/M3-cobranca.md` | Fase 2 |
| M4 | Atendimento ao Associado (FAQ categorizado + Q&A) | `modules/M4-associado.md` | Fase 2 |
| M5 | Comercial / Leads | `modules/M5-comercial.md` | Fase 3 |
| M6 | Monitoramento & Evolução contínua | `modules/M6-monitoramento.md` | Transversal |

## Sequenciamento e dependências

```
Fase 1 (agora) ── M1: CrmClient mock-first + tools CRM + roteamento por intenção (orchestrator)
   │                 dependência de M3 (régua) e M5 (lead) → CRM precisa existir primeiro
   ▼
Fase 2 ─────────── M3 cobrança ativa (billing-runner.ts + cron Dokploy, régua, janela D+1)
   │               M4 FAQ categorizado + ingestão da planilha Q&A da Jaine no RAG
   ▼
Fase 3 ─────────── M2 placa→unidade responsável + verificação base de seguros
                   M5 qualificação de lead + gatilhos + resumo→consultor + recuperação de oportunidade
   │
   ▼
Go-live ────────── troca dos mocks (CRM/SGA) pelos contratos reais + credenciais
```

Dependências duras:
- **M3 e M5 dependem de M1-CRM** (régua usa status financeiro do SGA; lead usa CRM).
- **M3 régua ativa depende de scheduler** (Dokploy `schedule-*` / cron) — fora do fluxo inbound atual.
- ~~UAT depende de reconciliar SgaClient ↔ simulate-agent~~ ✅ **Concluído**: `SgaClient` reescrito para a API Hinova v2 real (two-step auth + billing); `simulate-agent` e o simulador interativo rodam fim-a-fim.

## Gates de teste contínuo

### Dia 60 — testes assistidos com a equipe (pré go-live)
- M1 roteamento por intenção validado no `simulate-agent.ts` (5 frentes, sem menu rígido).
- ✅ `SgaClient` na API Hinova v2 real; `simulate-agent` e simulador interativo (`wa-sim-server.ts`) rodam fim-a-fim.
- M3 2ª via + M4 FAQ + fluxos SGA de sinistro/cotação verdes.
- Cobrança ativa (M3) em modo observação (dry-run, sem disparo real) respeitando janela D+1.
- Sem vazamento LGPD nos cenários 6.x; handoff funcionando.

### Dia 90 — otimização e evolução
- M5 comercial completo (qualificação, urgência, resumo→consultor, recuperação).
- M2 placa→unidade em produção.
- Régua de cobrança ativa em produção com tom suave e métricas de inadimplência.
- Revisão periódica de conversas (M6) gerando ajustes de saudação/atendimento.

## Itens de bloqueio vindos do onboarding (ações de terceiros)
- [Lucas] **Credenciais reais do SGA** (`SGA_USUARIO`/`SGA_SENHA`/`SGA_API_TOKEN`) + confirmar códigos operacionais (`SGA_CLAIM_*`, `SGA_BOLETO_OPEN_STATUS_CODE`, regional). A integração já está escrita contra a API Hinova v2 real — falta só preencher o `.env`.
- [Lucas] Documentação da **API do CRM** → destrava troca do mock M1 pelo real (CRM é o único ainda mock).
- [Jaine] Planilha de **perguntas e respostas** categorizadas (sinistro/comercial/associado) → M4.
- [Lucas] Chatbot atual compartilhado → base para fluxos.
- [Grupo] Categorização das dúvidas frequentes → M4.
