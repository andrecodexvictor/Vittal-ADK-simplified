
# Product Requirements Document — AprovaAuto AI

## 1. Identidade
- Cliente: AprovaAuto
- Canal: WhatsApp via UAZAPI
- Slug: `aprovauto-ai`
- Nível: `transactional`

## 2. Objetivo
O AprovaAuto AI atende associados e leads no WhatsApp para:
- Qualificação e cotação de proteção veicular.
- Segunda via financeira com boleto, linha digitável ou Pix.
- Abertura guiada e acompanhamento de sinistros.
- Respostas FAQ com RAG local.

O agente não aprova indenizações, não altera contratos, não concede descontos não autorizados e não conduz cancelamento sem handoff.

## 3. Integrações SGA
- `tool_sga_search_vehicle`: busca veículo por `plate` ou `modelName`.
- `tool_sga_simulate_quote`: simula mensalidade por `vehicleValue`, `hasTracker` e `coverages`.
- `tool_sga_get_financial_invoice`: consulta faturas por `cpf` + `plate`; nunca usar apenas CPF.
- `tool_sga_create_claim`: cria sinistro com CPF, placa, data/hora, local, descrição e terceiros.
- `tool_sga_upload_claim_document`: envia documento/foto por `multipart/form-data`.
- `tool_sga_get_claim_status`: consulta status por `claimId` ou CPF.

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
