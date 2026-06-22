# Guia de Configuração — VITTAL ADK Simplificado

Este documento detalha todas as variáveis de ambiente e flags de comportamento que podem ser configuradas no arquivo `.env` de cada agente.

---

## 🔑 Variáveis Principais

### 1. Webhook
- **`WEBHOOK_SECRET`**: Segredo de autenticação Timing-Safe. Deve ser idêntico ao token configurado na UAZAPI. Se a chamada não contiver este token na URL (`?token=...`) ou no header `token`, a requisição será descartada.

### 2. Vittal Hub
- **`HUB_BASE_URL`**: URL do Vittal Hub centralizador (padrão: `https://hub.vittalweb.com`).
- **`HUB_AGENT_KEY`**: Chave de autenticação exclusiva gerada para o agente específico no Hub.

### 3. OpenAI
- **`OPENAI_API_KEY`**: Sua chave de API do OpenAI (`sk-...`).
- **`OPENAI_MODEL`**: Modelo utilizado (ex: `gpt-4o-mini`, `gpt-4o`).
- **`OPENAI_MAX_TOKENS`**: Limite de tokens na resposta (padrão: `1024`).
- **`OPENAI_TEMPERATURE`**: Criatividade das respostas entre `0.0` e `2.0` (padrão: `0.6`).
- **`OPENAI_HISTORY_LIMIT`**: Limite de mensagens antigas da conversa passadas como contexto para o modelo (padrão: `20`).

### 4. RabbitMQ
- **`RABBITMQ_URL`**: Conexão do broker RabbitMQ (ex: `amqp://user:pass@localhost:5672`).
- **`RABBITMQ_EXCHANGE`**: Exchange de roteamento (padrão: `vittal.messages`).
- **`RABBITMQ_ROUTING_KEY`**: Chave de roteamento do broker (padrão: `message.direct`).

### 5. Outbound / UAZAPI
- **`OUTBOUND_PROVIDER`**: Canal de saída (padrão: `uazapi`).
- **`OUTBOUND_SOURCE`**: Identificador do remetente (slug do agente).
- **`UAZAPI_URL`**: URL da instância UAZAPI (padrão: `https://flowcrm.uazapi.com`).
- **`UAZAPI_TOKEN`**: Token da instância ativa no WhatsApp.
- **`UAZAPI_BASE_URL`**: URL para envio direto de mídia HTTP (exigida para imagens, botões e listas).

### 6. SGA / AprovaAuto
- **`SGA_BASE_URL`**: URL base da API SGA.
- **`SGA_API_TOKEN`**: Token Bearer enviado no cabeçalho `Authorization`.
- **`SGA_TIMEOUT_MS`**: Timeout por chamada ao SGA (padrão: `10000`).
- **`SGA_CIRCUIT_FAILURE_THRESHOLD`**: Número de falhas para abrir o circuit breaker (padrão: `3`).
- **`SGA_CIRCUIT_WINDOW_MS`**: Janela de contagem de falhas do circuit breaker (padrão: `60000`).
- **`SGA_CIRCUIT_OPEN_MS`**: Tempo de bloqueio enquanto o circuit breaker estiver aberto (padrão: `120000`).
- **`SGA_MAX_UPLOAD_BYTES`**: Tamanho máximo de documento enviado ao SGA (padrão: `10485760`).
- **`SGA_USUARIO`** / **`SGA_SENHA`**: Credenciais do usuário ATIVO do SGA enviadas no corpo de `POST /usuario/autenticar` (auth two-step). O `token_usuario` retornado é cacheado e usado como Bearer; não expira.
- **`SGA_DEFAULT_REGIONAL`** / **`SGA_DEFAULT_TIPO_VEICULO`**: Códigos usados na simulação de rateio quando não vierem do veículo.
- **`SGA_CLAIM_STATUS_CODE`** / **`SGA_CLAIM_TYPE_CODE`** / **`SGA_SINISTRO_DEPT_CODE`**: Códigos operacionais para abrir sinistro em `/cadastrar/historico-atendimento-associado`.
- **`SGA_BOLETO_OPEN_STATUS_CODE`**: Código da situação "ABERTO" do boleto (padrão: `2`). Confirme via `GET /listar/situacao-boleto/todos`.

### 6.1 Régua de Cobrança Ativa (worker `billing-runner.ts`)
- **`BILLING_DRY_RUN`**: Se `true` (padrão), apenas registra os lembretes que enviaria, sem publicar. Use `false` (ou `--live`) para disparar de verdade.
- **`BILLING_OVERDUE_GRACE_DAYS`**: Janela de carência D+1 — não cobra boletos vencidos há ≤ N dias (baixa manual; padrão: `2`).
- **`BILLING_PAGE_SIZE`** / **`BILLING_MAX_PAGES`**: Paginação da varredura de boletos (padrões: `3000` / `20`).
- **`BILLING_REMINDER_GROUP`**: (opcional) grupo para resumo dos disparos.

### 7. CRM / AprovaAuto (mock-first)
> Todas opcionais com default enquanto a integração é mock-first. Ao trocar pelo CRM real, preencher e declarar em `requiredEnv` do plugin `custom.crm`. Contrato placeholder: `agents/aprovauto-ai/whatsapp/spec/crm.openapi.json`.
- **`CRM_BASE_URL`**: URL base da API do CRM (padrão: `https://crm.aprovauto.local`).
- **`CRM_BEARER_TOKEN`**: Token Bearer enviado no cabeçalho `Authorization`.
- **`CRM_TIMEOUT_MS`**: Timeout por chamada ao CRM (padrão: `10000`).
- **`CRM_CIRCUIT_FAILURE_THRESHOLD`**: Falhas para abrir o circuit breaker do CRM (padrão: `3`).
- **`CRM_CIRCUIT_WINDOW_MS`**: Janela de contagem de falhas (padrão: `60000`).
- **`CRM_CIRCUIT_OPEN_MS`**: Tempo de bloqueio com o breaker aberto (padrão: `120000`).

---

## ⚙️ Feature Flags (Ativação de Comportamento)

Todas as flags aceitam valores booleanos: `true` ou `false`.

- **`FEATURE_RESPONDER_GRUPOS`**: Se `true`, o bot responderá a mensagens recebidas em grupos (desde que obedeçam às whitelists ou trigger words).
- **`FEATURE_ACIONAR_ATENDENTE`**: Ativa o Handoff Humano. Se `true`, quando o modelo chamar a ferramenta `human_handoff`, o agente será pausado e os atendentes cadastrados serão notificados.
- **`FEATURE_RAG`**: Habilita a busca semântica em arquivos de texto locais colocados em `knowledge/`.
- **`FEATURE_PROCESSAR_AUDIO`**: Habilita a descriptografia automática de áudios PTT (.enc) do WhatsApp e sua transcrição síncrona via Whisper-1.
- **`FEATURE_PROCESSAR_IMAGEM`**: Habilita o envio de imagens recebidas em formato base64 para o modelo GPT Vision.
- **`FEATURE_GROUP_NOTIFICATIONS`**: Envia alertas estruturados de agendamentos e transações de atendimento para o grupo configurado.

---

## 🎯 Filtros e Whitelists

- **`TRIGGER_WORD`**: Palavra-chave obrigatória para ativar a IA. Se configurada, o agente ignora mensagens que não contenham esta palavra exata. Útil para bots em grupos de WhatsApp.
- **`WHITELIST_NUMBERS`**: Números de telefone separados por vírgula (ex: `5511999999999,5521888888888`). Se preenchida, o agente só responderá a estas pessoas.
- **`WHITELIST_GROUPS`**: IDs de grupos de WhatsApp separados por vírgula permitidos.

---

## 👥 Handoff & Notificações de Grupo

- **`HANDOFF_ATTENDANTS`**: Lista de telefones de atendentes de CRM/Recepção separados por vírgula (ex: `5511999999999`). Novos chamados serão distribuídos entre eles em esquema round-robin.
- **`HANDOFF_ANNOUNCEMENT_GROUP`**: ID do grupo do WhatsApp onde alertas de atendimentos solicitados serão publicados.
- **`AGENDAMENTO_ANNOUNCEMENT_GROUP`**: ID do grupo do WhatsApp onde alertas de novos agendamentos serão publicados.
- **`GROUP_NOTIFICATION_TOKEN`**: Token UAZAPI do número que participará dos grupos para enviar os anúncios de handoff/agendamentos.
