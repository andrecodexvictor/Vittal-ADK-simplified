# Vittal ADK Simplificado 🤖

Seja bem-vindo ao **Vittal ADK Simplificado**! Este é o Kit de Desenvolvimento de Agentes (ADK) interno da Vittal, otimizado para que você possa criar, testar e rodar agentes de WhatsApp e CRM de forma rápida, eficiente e **offline-first**.

Inspirado no Google ADK, este repositório simplifica a arquitetura clássica removendo camadas desnecessárias de boilerplate, separando claramente o **Core Engine** (`src/core/`) e os **Service Adapters** (`src/services/`). Além disso, resolve o vazamento de configurações globais carregando variáveis de ambiente e manifests dinamicamente de cada diretório do agente.

---

## 🚀 Guia de Início Rápido (para Estagiários e Devs)

Se você acabou de chegar no projeto e precisa rodar o protótipo ou criar um novo agente, siga os passos abaixo.

### 1. Instalar as Dependências

Certifique-se de ter o [Bun](https://bun.sh) instalado. No terminal, execute:

```bash
bun install
```

### 2. Configurar o Agente (`AprovaAuto AI`)

Vá até a pasta do protótipo e crie o arquivo `.env`:

```bash
cp agents/aprovauto-ai/whatsapp/.env.example agents/aprovauto-ai/whatsapp/.env
```

Abra o arquivo `agents/aprovauto-ai/whatsapp/.env` e insira suas credenciais (`OPENAI_API_KEY`, `WEBHOOK_SECRET`, `UAZAPI_TOKEN`, `SGA_BASE_URL` e `SGA_API_TOKEN`).

### 3. Rodar os Testes Offline

Todos os testes de agentes são escritos em TypeScript puro e rodam em menos de 1 segundo utilizando mocks locais. Para rodar:

```bash
bun test
```

Para rodar apenas os testes do AprovaAuto:

```bash
bun test agents/aprovauto-ai/whatsapp/tests
```

### 4. Iniciar o Agente Localmente

Para subir o servidor HTTP local apontando para o AprovaAuto:

```bash
bun dev --agent aprovauto-ai
```

O servidor subirá na porta `3000`.

---

## 🛠️ Como Criar um Novo Agente do Zero

Para gerar um novo esqueleto de agente, execute o comando na raiz do repositório:

```bash
bun create-agent "Nome da Empresa" "Descrição Breve" "whatsapp"
```

### O que o script faz?
1. Cria a pasta `agents/nome-da-empresa/whatsapp/`.
2. Cria os subdiretórios `spec/` (especificação), `prompts/`, `knowledge/` (RAG) e `tests/`.
3. Scaffolda arquivos iniciais interpolando o nome da empresa e slug.
4. Gera um arquivo de testes em TypeScript (`tests/agent.test.ts`) contendo mocks prontos para rodar offline.
5. Se `HUB_API_KEY` estiver preenchida no seu `.env` global, ele registra automaticamente o agente no Vittal Hub. Caso contrário, o script funciona offline sem travar a geração.

---

## 🌐 Integração Webhook e Cloudflare Tunnels

O agente recebe mensagens do WhatsApp em tempo real através de requisições `POST /webhook` enviadas pela UAZAPI. 

Para receber os webhooks do WhatsApp em sua máquina de desenvolvimento local:

1. Suba o agente localmente:
   ```bash
   bun dev --agent aprovauto-ai
   ```
2. Abra outro terminal e crie um túnel Cloudflare apontando para a porta 3000:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. Copie a URL HTTPS pública gerada pela Cloudflare (ex: `https://xxxx-xx-xx.trycloudflare.com`).
4. Acesse o painel da UAZAPI e configure o Webhook da sua instância apontando para a URL copiada com o sufixo `/webhook` e a query string de autenticação:
   `https://xxxx-xx-xx.trycloudflare.com/webhook?token=SEU_WEBHOOK_SECRET`

---

## 📁 Estrutura do Projeto

```
VITTAL ADK simplified/
├── package.json          # Dependências do projeto
├── tsconfig.json         # Configurações TypeScript
├── README.md             # Este manual de instrução
├── CONFIGURACAO.md       # Referência das variáveis de ambiente e flags
├── src/
│   ├── core/
│   │   ├── config.ts     # Validador de configurações Zod por agente
│   │   ├── manifest.ts   # Validador de manifest do agente
│   │   ├── logger.ts     # Logger Pino estruturado
│   │   └── ProcessMessage.ts # Orquestrador principal do ciclo de mensagens
│   ├── services/
│   │   ├── OpenAIProvider.ts # Completions e tool loops da OpenAI
│   │   ├── LangChainRag.ts   # Busca semântica local com cache de embeddings
│   │   ├── RabbitMQ.ts       # Publicador com fallback de mídia direta HTTP
│   │   ├── MediaService.ts   # Descriptografia PTT e transcrição Whisper
│   │   └── RestConversationRepository.ts # Conexão de estado e logs com o Vittal Hub
│   └── presentation/
│       └── server.ts     # Servidor Hono, tratamento de Webhook, Debounce e Dedup
├── scripts/
│   ├── create-agent.ts   # Script offline-first para criar agentes
│   └── run-agent.ts      # Inicializador dinâmico de agente específico
├── templates/
│   └── agent/            # Modelos de scaffolding para novos agentes
└── agents/               # Local onde residem os agentes
```

---

## 🧠 Arquitetura do RAG (Retrieval-Augmented Generation)

### Como funciona localmente?
1. Ao ativar `FEATURE_RAG=true`, o engine varre os arquivos `.md` e `.txt` na pasta `knowledge/` do agente.
2. Os arquivos são segmentados de acordo com cabeçalhos markdown (`#`, `##`) e limites de caracteres (com overlap).
3. Geramos embeddings usando `text-embedding-3-small` da OpenAI.
4. Para economizar tokens de API, os embeddings calculados são cacheados em disco na pasta `.rag-cache/embeddings.json` daquele agente. Sempre que o servidor reinicia ou novos textos são indexados, apenas os blocos alterados solicitam embeddings à API.
5. Injetamos o contexto relevante no system prompt do modelo.

### 💾 Escalando para Banco de Dados com Prisma/Postgres
Se o seu RAG crescer ou você precisar persistir o histórico e os vetores de múltiplos agentes em produção:

1. **Adicionar Prisma**:
   ```bash
   bun add @prisma/client
   bun add -d prisma
   bun prisma init
   ```
2. **Modelagem**: Crie no seu `prisma/schema.prisma` tabelas para armazenar as mensagens (`Message`) e os embeddings em um vetor Postgres (usando a extensão `pgvector`):
   ```prisma
   model DocumentChunk {
     id        String   @id @default(uuid())
     content   String
     source    String
     section   String?
     embedding Unsupported("vector(1536)")? // se usar pgvector e text-embedding-3-small
   }
   ```
3. **Substituir o Provedor**: No arquivo `src/services/LangChainRag.ts`, em vez de inicializar o `MemoryVectorStore`, você pode instanciar o `PrismaVectorStore` ou realizar buscas semânticas nativas com queries SQL `prisma.$queryRaw` comparando distância de cosseno.

---

## 🧪 Escrevendo Testes em TypeScript

Em vez de arquivos JSONL genéricos, os testes são escritos em arquivos `.test.ts` nativos do Bun, utilizando a estrutura `describe`/`test` do Jest. 

### Exemplo de Teste de Fluxo:
```typescript
import { expect, test, describe, beforeAll } from 'bun:test'
import { ProcessMessage } from '../../../src/core/ProcessMessage'

describe('Teste de Escopo', () => {
  test('Deve recusar perguntas de passagens aéreas', async () => {
    // ...
    // Insira sua lógica de teste mockando o AIProvider ou injetando mensagens de teste
  })
})
```

Rode os testes com:
```bash
bun test
```

---

Desenvolvido com carinho pela equipe de engenharia da Vittal.
Caso tenha dúvidas ou queira propor melhorias, fale com o seu líder técnico!
