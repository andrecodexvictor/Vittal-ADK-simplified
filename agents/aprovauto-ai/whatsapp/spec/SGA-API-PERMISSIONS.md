# Permissões da Chave de API SGA/ERP (Hinova) — AprovaAuto

> Checklist para geração do token de API no SGA/ERP da Hinova.
> Base: endpoints já chamados pelo `src/services/SgaClient.ts` + módulos da Fase 3 (M2 sinistro, M3 cobrança ativa, M5 comercial) já especificados.
> **Princípio:** menor privilégio (LGPD). Marcar só o necessário.

---

## 🔎 Resultado da descoberta na API real (jun/2026)

Rodado `scripts/sga-discover.ts` contra a API real com o token atual. O SGA retorna
**406 "Rota não permitida. É necessário a liberação da rota pelo cliente"** quando o
path existe mas a rota **não está habilitada no token** (tela: Área Cliente → APIs →
Gerenciar APIs → Tópico X → marcar o endpoint).

### ✅ Já liberados no token (funcionando)
Runtime do agente todo OK: `veiculo/buscar-por-permissao`, `modelo/listar`,
`buscar/rateio-medio`, `buscar/situacao-financeira-veiculo`, `listar/boleto/periodo`,
`listar/boleto-associado/periodo`, `listar/evento-veiculo`. **Catálogos:**
`listar/status-atendimento/todos`, `listar/tipo-atendimento/todos`,
`listar/situacao-boleto/todos`, `listar/regional/todos`.

### 🔒 Falta o cliente liberar (path confirmado, retorna "não permitida")
Necessárias para os opcionais e para M2 completo:

| Tópico | Endpoint (nome na tela) | Path | Para quê |
|---|---|---|---|
| Atendimento | listar departamento | `GET /listar/departamento/todos` | resolver `SGA_SINISTRO_DEPT_CODE` |
| Produto | listar grupo produto | `GET /listar/grupo-produto/todos` | catálogo de planos (M5/FAQ) |
| Situação | listar por permissão | `GET /listar/situacao/todos` | interpretar status de forma estável |
| Evento | listar situação | `GET /listar/situacao-evento/todos` | status de sinistro estável |
| Vistoria | listar tipo | `GET /listar/tipo-vistoria/todos` | tipos de vistoria |

> **`listar/vistoria` (período)** já está liberado (POST com `data_vistoria_inicial`/`data_vistoria_final`).
> **`listar produto`** e **`listar produto vinculado`** (cobertura por placa, M2): path ainda não
> confirmado (retornaram 404 = path errado). Confirmar nome exato com a Hinova OU habilitar o
> Tópico Produto completo e re-rodar `sga-discover.ts`.

### Códigos reais resolvidos (já no `.env`)
| Variável | Valor | Origem |
|---|---|---|
| `SGA_CLAIM_STATUS_CODE` | **3** | status-atendimento "EM ABERTO" |
| `SGA_CLAIM_TYPE_CODE` | **6** | tipo-atendimento "SINISTRO - ABERTURA" |
| `SGA_BOLETO_OPEN_STATUS_CODE` | **2** | situacao-boleto "ABERTO" (`considerado_inadimplencia: Y`) |
| `SGA_DEFAULT_REGIONAL` | **1** | regional "APROVAUTO (ABB)" |
| `SGA_SINISTRO_DEPT_CODE` | **0** (pendente) | depende de liberar "listar departamento" |

**Regionais disponíveis** (para montar `SGA_REGIONAL_UNIT_MAP`): 1/14 APROVAUTO (ABB),
13 Tabela Antiga, 15 Aprove Autos, 2 Goiânia, 6 Norte Bahia, 3 Oeste, 4 Sudoeste Bahia.

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
