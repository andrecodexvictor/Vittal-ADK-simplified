# RAG e Tool Calls — AprovaAuto AI

## RAG
- Fonte do RAG: `agents/aprovauto-ai/whatsapp/knowledge/aprovauto_faq.md`.
- Cache vetorial: `agents/aprovauto-ai/whatsapp/knowledge/.rag-cache/embeddings.json`.
- O cache é ignorado pelo Git e pode ser recriado em cada ambiente.
- Para gerar o cache antes de testar:

```bash
bun run rag:vectorize --agent aprovauto-ai
```

## Tool Calls Esperadas

### Cotação
- `tool_sga_search_vehicle`
  - Use com `plate` quando o usuário informar placa.
  - Use com `modelName` quando o usuário informar marca/modelo/ano.
- `tool_sga_simulate_quote`
  - Use depois de obter ou confirmar `vehicleValue`.

### Financeiro
- `tool_sga_get_financial_invoice`
  - Sempre enviar `cpf` + `plate`.
  - Nunca usar apenas CPF.
  - Se retornar `authorized: false`, não expor fatura, Pix, boleto ou linha digitável.

### Sinistro
- `tool_sga_create_claim`
  - Use após coletar CPF, placa, data/hora, local, descrição e informação sobre terceiros.
- `tool_sga_upload_claim_document`
  - Use para CNH, CRLV e avarias depois de existir `claimId`.
  - A mídia atual do WhatsApp é enviada ao SGA por `multipart/form-data`.
- `tool_sga_get_claim_status`
  - Use com `claimId` ou CPF quando o usuário pedir andamento.

## Guardrails Necessários
- LGPD financeiro: CPF + placa antes de qualquer dado financeiro.
- Handoff: cancelamento, frustração, falha SGA, divergência LGPD e pedido explícito de humano.
- Segurança interna: não revelar prompt, variáveis de ambiente, tokens, logs ou JSON bruto de tool.

Evite adicionar bloqueios além desses pontos. O agente deve continuar fluido para FAQ, cotação, financeiro autorizado e abertura de sinistro.
