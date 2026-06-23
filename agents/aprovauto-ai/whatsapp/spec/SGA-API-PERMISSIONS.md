# Permissões da Chave de API SGA/ERP (Hinova) — AprovaAuto

> Checklist para geração do token de API no SGA/ERP da Hinova.
> Base: endpoints já chamados pelo `src/services/SgaClient.ts` + módulos da Fase 3 (M2 sinistro, M3 cobrança ativa, M5 comercial) já especificados.
> **Princípio:** menor privilégio (LGPD). Marcar só o necessário.

## Estratégia de chave

- **1 chave única** atende todo o escopo (o `SgaClient` usa um só `SGA_API_TOKEN`). **Começar assim.**
- Deixar aberta a possibilidade de **2 chaves** no futuro (isolamento de risco):
  - **Chave A — operacional:** VEÍCULO + ATENDIMENTO + REGIONAL
  - **Chave B — financeiro:** BOLETO
- Hoje o código aponta para um token único — separar só se a Vittal quiser isolar o financeiro depois.

---

## ✅ Marcar — necessário AGORA (já implementado em código)

### Grupo VEÍCULO
- [ ] **Buscar por permissão** — cotação/consulta por placa (`GET /veiculo/buscar-por-permissao`)
- [ ] **Buscar rateio** — simulação de cotação (`POST /buscar/rateio-medio`)
- [ ] **Buscar** *(ou Buscar situação)* — dados do veículo + contrato ativo
- [ ] **Situação financeira** — adimplência por placa (`GET /buscar/situacao-financeira-veiculo`)
- [ ] **Listar modelo** — cotação por modelo sem placa (`POST /modelo/listar`)

### Grupo ATENDIMENTO (histórico de atendimento = sinistro)
- [ ] **Cadastrar** — abre o sinistro (`POST /cadastrar/historico-atendimento-associado`)
- [ ] **Cadastrar foto/documento** — upload CNH/CRLV/avarias (`POST /historico-atendimento-associado/foto/cadastrar`)
- [ ] **Listar histórico atendimentos de associado** — acompanhamento/status do sinistro
- [ ] **Listar status** — descobrir `SGA_CLAIM_STATUS_CODE`
- [ ] **Listar tipo** — descobrir `SGA_CLAIM_TYPE_CODE`
- [ ] **Listar departamento** — descobrir `SGA_SINISTRO_DEPT_CODE`

### Grupo BOLETO (financeiro — M3)
- [ ] **Listar por período** — 2ª via reativa (`POST /listar/boleto/periodo`)
- [ ] **Listar por associado** — varredura da cobrança ativa (`POST /listar/boleto-associado/periodo`)
- [ ] **Listar situações** — descobrir `SGA_BOLETO_OPEN_STATUS_CODE` (código de "ABERTO")
- [ ] **Buscar lista de boletos por nosso número** — 2ª via direta por boleto

---

## ⏭️ Marcar — Fase 3 (módulos já especificados)

### Grupo REGIONAL — M2 placa→unidade responsável
- [ ] **Listar**
- [ ] **Buscar**
- _Mapeia `codigo_regional` do veículo → unidade/equipe correta antes do transbordo._

### Grupo BOLETO — M3 renegociação
- [ ] **Alterar vencimento** — reagendar boleto na régua (`POST /alterar/vencimento-boleto`)

### Grupo VEÍCULO — M2 verificação de cobertura
- [ ] **Listar produto vinculado** *(ou Listar produto vinculado paginado)* — confirmar cobertura ativa antes de abrir sinistro

---

## 🔮 Opcional — evolução futura (marcar só se quiser folga)

| Grupo | Permissão | Uso futuro |
|---|---|---|
| PRODUTO | Listar / Listar grupo | Respostas sobre planos e coberturas (M5 comercial) |
| TERMO | Aceite digital / Emitir | Contratação digital de novos associados (M5) |
| SITUAÇÃO | Listar por situação | Interpretar códigos de status de forma estável |
| VISTORIA | Listar / Solicitar vistoria | Revistoria ligada a sinistro |
| INDICAÇÃO EXTERNA | Cadastrar / Listar | Indicação/lead vindo de associado |

---

## ❌ NÃO marcar (fora de escopo + risco LGPD)

- **COBRANÇA CARTÃO** (todos) — não tratamos dados de cartão
- **BENEFICIÁRIO** (todos) — não acessamos dependentes
- **MGF** (todos) — razão financeira interna, sem uso
- **COOPERATIVA / COTA / FORNECEDOR / VOLUNTÁRIO / CAMPOS OPCIONAIS** — sem uso no escopo
- **USUARIO > Buscar** — autenticação é implícita, não precisa
- **BOLETO > Emitir** — emissão de boleto novo fora de escopo (prioridade: 2ª via + lembrete)
- Qualquer **Alterar / Excluir / Cadastrar** fora das listas acima

---

## Códigos operacionais a preencher no `.env`

Os "Listar" do ATENDIMENTO e do BOLETO **não são usados em runtime** — servem para descobrir estes códigos:

| Variável `.env` | Origem (onde olhar no SGA) |
|---|---|
| `SGA_CLAIM_STATUS_CODE` | Atendimento → Listar status |
| `SGA_CLAIM_TYPE_CODE` | Atendimento → Listar tipo |
| `SGA_SINISTRO_DEPT_CODE` | Atendimento → Listar departamento |
| `SGA_BOLETO_OPEN_STATUS_CODE` | Boleto → Listar situações (código de "ABERTO") |
| `SGA_DEFAULT_REGIONAL` | Regional → Listar |
| `SGA_DEFAULT_TIPO_VEICULO` | Veículo (default da cotação) |

Credenciais de acesso (também no `.env`): `SGA_USUARIO`, `SGA_SENHA`, `SGA_API_TOKEN` (Bearer estático da chave), `SGA_BASE_URL`.
