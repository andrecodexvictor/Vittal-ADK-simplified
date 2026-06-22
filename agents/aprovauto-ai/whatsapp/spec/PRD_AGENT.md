
# Product Requirements Document — AprovaAuto AI

> Estrutura modular completa em `spec/ROADMAP.md` e `spec/modules/M1..M6-*.md`. Loop de desenvolvimento em `spec/DEV-LOOP.md`.

## 1. Identidade
- Cliente: AprovaAuto
- Canal: WhatsApp via UAZAPI
- Slug: `aprovauto-ai`
- Nível: `orchestrator` (roteamento por intenção entre as frentes sinistro/comercial/financeiro/associado)

## 2. Objetivo
O AprovaAuto AI atende associados e leads no WhatsApp para:
- Qualificação e cotação de proteção veicular.
- Segunda via financeira com boleto, linha digitável ou Pix.
- Abertura guiada e acompanhamento de sinistros.
- Respostas FAQ com RAG local.

O agente não aprova indenizações, não altera contratos, não concede descontos não autorizados e não conduz cancelamento sem handoff.

## 2.1 Roteamento por Intenção
Antes de pedir dados ou transferir, o agente classifica a intenção em `{cotacao_comercial, financeiro_cobranca, sinistro, associado_faq, humano}` e segue o fluxo correspondente. Não usa menu numérico rígido; usa contexto (placa → veículo/contrato/unidade). Detalhe em `spec/modules/M1-integracao-roteamento.md` e `prompts/system.md` (seção 0).

## 3. Integrações SGA
- `tool_sga_search_vehicle`: busca veículo por `plate` ou `modelName`.
- `tool_sga_simulate_quote`: simula mensalidade por `vehicleValue`, `hasTracker` e `coverages`.
- `tool_sga_get_financial_invoice`: consulta faturas por `cpf` + `plate`; nunca usar apenas CPF.
- `tool_sga_create_claim`: cria sinistro com CPF, placa, data/hora, local, descrição e terceiros.
- `tool_sga_upload_claim_document`: envia documento/foto por `multipart/form-data`.
- `tool_sga_get_claim_status`: consulta status por `claimId` ou CPF.

## 3.1 Integrações CRM (mock-first)
> Contrato placeholder em `spec/crm.openapi.json`; trocar pelo CRM real quando a doc do Lucas chegar.
- `tool_crm_get_contact`: recupera contexto do contato por `phone` ou `cpf` (associado?, oportunidade aberta, tags).
- `tool_crm_upsert_lead`: cria/atualiza lead comercial (idempotente por telefone) com `stage`.
- `tool_crm_log_interaction`: registra resumo estruturado da conversa antes do handoff de vendas.
- Falha de CRM → mensagem amigável + handoff (mesmo padrão do SGA).

## 4. Segurança e LGPD
- Dados financeiros só podem ser exibidos após validação de CPF + placa ativa.
- Divergência CPF/placa deve negar exibição e transbordar para financeiro humano.
- Logs devem evitar CPF completo; usar apenas últimos 4 dígitos quando necessário.

## 5. Falhas
- Timeout, 5xx, erro de rede ou circuit breaker aberto no SGA exige mensagem amigável, log técnico e handoff humano.
- Circuit breaker: 3 falhas em 60s abre por 2 minutos.

## 6. Critérios de Sucesso
- Responder sempre em português do Brasil.
- Fazer uma pergunta por vez.
- Coletar dados obrigatórios antes de chamar tools.
- Nunca expor boleto, Pix ou linha digitável sem autorização LGPD.
