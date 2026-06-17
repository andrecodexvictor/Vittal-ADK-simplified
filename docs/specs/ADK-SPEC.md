# ADK-SPEC.md - Especificação do ADK Simplificado

## 1. Propósito do ADK

O VITTAL ADK Simplificado é um kit de desenvolvimento de agentes de CRM/WhatsApp focado em:
- **Simplicidade**: Sem excesso de camadas de Clean Architecture. Divisão clara entre `core/` (regras de negócio) e `services/` (integrações).
- **Sem Vazamento de Contexto**: Cada agente é 100% isolado. Suas variáveis de ambiente, prompts e manifests são carregados dinamicamente do próprio diretório do agente.
- **Testes Nativos**: Sem harnesses em JSONL com scripts de replay customizados. Testes de agentes são escritos em TypeScript puro e executados diretamente via `bun test`.
- **Fácil Aprendizado**: Curva de aprendizado curta para estagiários e novos desenvolvedores.

## 2. Principais Componentes

- **Core Engine**:
  - `src/core/config.ts`: Valida e carrega configurações.
  - `src/core/manifest.ts`: Lê a especificação do agente (`agent.manifest.json`).
  - `src/core/ProcessMessage.ts`: Orquestrador de mensagens e estado.
- **Service Adapters** (`src/services/`):
  - Provedor de IA (OpenAI, LangChain).
  - RAG semântico local (com cache em disco de embeddings).
  - Publicador de mensagens no RabbitMQ.
  - Provedores de mídias (áudio Whisper, visão GPT-4o-mini).
  - Handoff para humanos.
- **Automações**:
  - `scripts/create-agent.ts`: Scaffolda novos agentes de forma offline-first.
  - `scripts/run-agent.ts`: Roda um agente específico de forma limpa.

## 3. Estrutura de Diretórios Alvo

```
agents/
└── <cliente>/
    └── <canal>/ (ex: whatsapp)
        ├── .env
        ├── agent.manifest.json
        ├── prompts/
        │   └── system.md
        ├── knowledge/
        │   └── .gitkeep
        └── tests/
            └── agent.test.ts # Teste em TypeScript puro (bun test)
```
