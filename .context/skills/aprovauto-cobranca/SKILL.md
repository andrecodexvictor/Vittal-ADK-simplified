# aprovauto-cobranca — regras financeiras e régua de cobrança

Use quando: mexer no agente financeiro, na 2ª via, no billing-runner ou nas mensagens de cobrança.
Spec fonte: `agents/aprovauto-ai/whatsapp/spec/modules/M3-cobranca.md`.

## LGPD (inegociável)
Nunca expor dados financeiros/cadastrais sem validar **CPF + placa do veículo ativo**. Divergência → negar e transbordar ao financeiro humano.

## Régua ativa (billing-runner.ts)
- Estágios: `preventivo` (D-3) / `vencido_recente` (≤7d) / `vencido`. Mensagens de **tom suave** por estágio (`scripts/lib/billing-rules.ts`).
- **Janela D+1**: baixa de pagamento é manual no dia seguinte → não cobrar vencidos há ≤ `BILLING_OVERDUE_GRACE_DAYS` (default 2). Evita cobrança indevida.
- Idempotência: 1 lembrete por boleto+estágio por dia (cache `.billing-cache/`).
- `BILLING_DRY_RUN=true` até o gate de homologação da régua com o cliente; `--live` para disparar.

## API Hinova (financeiro)
- `POST /listar/boleto/periodo` (2ª via por CPF): exige `data_vencimento_inicial/final` dd/mm/yyyy e **janela ≤ 365 dias** (usamos -300d/+60d). Situação ABERTO = código 2.
- `POST /listar/boleto-associado/periodo`: varredura paginada da régua (traz celular, dias vencidos, linha digitável, link boleto).
- **Não existe Pix nativo** na API: oferecer link do boleto + linha digitável; Pix só se `pixCopyPaste` vier na resposta. Não prometer Pix.
- Renegociação (`POST /alterar/vencimento-boleto`) existe mas v1 transborda para humano.

## Divisão de agentes (plano agente-financeiro-aprovauto)
- `aprovauto-financeiro`: 2ª via, boletos, valores, régua, renegociação→handoff. Instância/número próprios.
- `aprovauto-ai`: comercial/sinistro/FAQ; intenção financeira → direciona ao número financeiro (fallback: atende como hoje enquanto o número não existir).
