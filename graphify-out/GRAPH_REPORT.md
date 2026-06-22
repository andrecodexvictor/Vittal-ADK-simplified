# Graph Report - .  (2026-06-22)

## Corpus Check
- 30 files · ~90,085 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 655 nodes · 892 edges · 49 communities (35 shown, 14 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_SGA Client & Billing|SGA Client & Billing]]
- [[_COMMUNITY_Dependencies & Scripts|Dependencies & Scripts]]
- [[_COMMUNITY_Intent Routing & Flows|Intent Routing & Flows]]
- [[_COMMUNITY_Plugins & Tool Registry|Plugins & Tool Registry]]
- [[_COMMUNITY_Firecrawl Scraper Integration|Firecrawl Scraper Integration]]
- [[_COMMUNITY_Manifest & Capabilities|Manifest & Capabilities]]
- [[_COMMUNITY_Biome Lint Config|Biome Lint Config]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_ADK Spec & Process|ADK Spec & Process]]
- [[_COMMUNITY_CRM Client (mock-first)|CRM Client (mock-first)]]
- [[_COMMUNITY_README & Principles|README & Principles]]
- [[_COMMUNITY_AprovaAuto Integration Specs|AprovaAuto Integration Specs]]
- [[_COMMUNITY_UAT Transcripts & Debriefing|UAT Transcripts & Debriefing]]
- [[_COMMUNITY_Agent Scaffolding|Agent Scaffolding]]
- [[_COMMUNITY_WhatsApp Simulator Server|WhatsApp Simulator Server]]
- [[_COMMUNITY_ProcessMessage & Config|ProcessMessage & Config]]
- [[_COMMUNITY_Server Bootstrap|Server Bootstrap]]
- [[_COMMUNITY_UAT Simulator Harness|UAT Simulator Harness]]
- [[_COMMUNITY_OpenAI Provider|OpenAI Provider]]
- [[_COMMUNITY_Conversation Repository|Conversation Repository]]
- [[_COMMUNITY_Message Orchestration Core|Message Orchestration Core]]
- [[_COMMUNITY_M1 Integration & Routing|M1 Integration & Routing]]
- [[_COMMUNITY_Roadmap & Modules|Roadmap & Modules]]
- [[_COMMUNITY_Package Metadata|Package Metadata]]
- [[_COMMUNITY_Proactive Billing Workers|Proactive Billing Workers]]
- [[_COMMUNITY_RabbitMQ Publisher|RabbitMQ Publisher]]
- [[_COMMUNITY_M5 Commercial  Leads|M5 Commercial / Leads]]
- [[_COMMUNITY_M2 Claims (placa-unidade)|M2 Claims (placa-unidade)]]
- [[_COMMUNITY_LangChain RAG|LangChain RAG]]
- [[_COMMUNITY_RabbitMQ Message Types|RabbitMQ Message Types]]
- [[_COMMUNITY_Conversation Repo Models|Conversation Repo Models]]
- [[_COMMUNITY_M4 Member Service  FAQ|M4 Member Service / FAQ]]
- [[_COMMUNITY_CICD Workflow|CI/CD Workflow]]
- [[_COMMUNITY_Process Helpers|Process Helpers]]
- [[_COMMUNITY_RAG Vectorizer|RAG Vectorizer]]
- [[_COMMUNITY_Agent Test Harness|Agent Test Harness]]
- [[_COMMUNITY_Docker  Dokploy Deploy|Docker / Dokploy Deploy]]
- [[_COMMUNITY_SGA Mock (sim)|SGA Mock (sim)]]
- [[_COMMUNITY_Media Service|Media Service]]
- [[_COMMUNITY_CRM Tools Test|CRM Tools Test]]
- [[_COMMUNITY_CRM Plugin & Tools|CRM Plugin & Tools]]
- [[_COMMUNITY_Scraper Crawl Job|Scraper Crawl Job]]
- [[_COMMUNITY_Run-Agent Bootstrap|Run-Agent Bootstrap]]
- [[_COMMUNITY_Intent Routing Test|Intent Routing Test]]
- [[_COMMUNITY_Security Guardrails|Security Guardrails]]
- [[_COMMUNITY_Conversational Examples|Conversational Examples]]
- [[_COMMUNITY_FAQ Knowledge Base|FAQ Knowledge Base]]
- [[_COMMUNITY_Plate Validation Guardrail|Plate Validation Guardrail]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 20 edges
2. `RestConversationRepository` - 16 edges
3. `ProcessMessage` - 14 edges
4. `config` - 14 edges
5. `SgaClient` - 14 edges
6. `AprovaAuto UAT Simulation Transcript` - 12 edges
7. `README.md — Vittal ADK Simplified` - 11 edges
8. `scripts` - 11 edges
9. `M5 — Atendimento Comercial Inteligente para Leads` - 11 edges
10. `RabbitMQPublisher` - 10 edges

## Surprising Connections (you probably didn't know these)
- `tool_sga_get_financial_invoice` --semantically_similar_to--> `Billing Runner Env Vars (BILLING_*)`  [INFERRED] [semantically similar]
  agents/aprovauto-ai/whatsapp/prompts/system.md → CONFIGURACAO.md
- `Example Client CLAUDE.md Template` --references--> `Karpathy-style Agent Engineering Principles`  [INFERRED]
  Reverse-API-scrapper-agent/outputs/example-client/CLAUDE.md → CLAUDE.md
- `Root CLAUDE.md — Agent Dev Guidelines` --references--> `README.md — Vittal ADK Simplified`  [EXTRACTED]
  CLAUDE.md → README.md
- `Claude.md Template (base mds)` --references--> `Karpathy-style Agent Engineering Principles`  [EXTRACTED]
  Reverse-API-scrapper-agent/base mds/Claude md teplate.md → CLAUDE.md
- `Reverse API Scraper GEMINI.md — Identity & Operational Manual` --references--> `Karpathy-style Agent Engineering Principles`  [EXTRACTED]
  Reverse-API-scrapper-agent/GEMINI.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Fluxo CRM de qualificação e handoff de lead** — modules_m5_comercial_qualificacao_lead, modules_m1_integracao_roteamento_tool_crm_upsert_lead, modules_m1_integracao_roteamento_tool_crm_log_interaction, modules_m5_comercial_resumo_consultor [EXTRACTED 1.00]
- **Infra de disparo proativo compartilhada (régua, follow-up, recuperação)** — modules_m3_cobranca_billing_runner, modules_m2_sinistro_followup_pendencias, modules_m5_comercial_recuperacao_oportunidade, modules_m3_cobranca_dokploy_schedule [EXTRACTED 1.00]
- **Bateria de validação do Gate Dia 60** — roadmap_gate_dia_60, modules_m6_monitoramento_simulate_agent, modules_m1_integracao_roteamento_sga_client, modules_m3_cobranca_billing_runner [EXTRACTED 1.00]
- **Commercial Quote Flow (vehicle search, quote sim, CRM lead, handoff)** — prompts_system_flow_cotacao_comercial, prompts_system_tool_sga_search_vehicle, prompts_system_tool_sga_simulate_quote, prompts_system_tool_crm_upsert_lead, prompts_system_human_handoff [EXTRACTED 1.00]
- **Financial Second-Copy Flow with LGPD + Pix Guardrails** — prompts_system_flow_segunda_via_financeira, prompts_system_tool_sga_get_financial_invoice, prompts_system_guardrail_lgpd_cpf_placa, prompts_system_guardrail_no_pix_unless_present [EXTRACTED 1.00]
- **Claim Opening Flow (create claim, upload docs, status)** — prompts_system_flow_abertura_sinistro, prompts_system_tool_sga_create_claim, prompts_system_tool_sga_upload_claim_document, prompts_system_tool_sga_get_claim_status [EXTRACTED 1.00]

## Communities (49 total, 14 thin omitted)

### Community 0 - "SGA Client & Billing"
Cohesion: 0.07
Nodes (35): addDays(), buildMessage(), classify(), daysBetween(), fmtDate(), parseDue(), ReguaOptions, Stage (+27 more)

### Community 1 - "Dependencies & Scripts"
Cohesion: 0.05
Nodes (36): dependencies, dotenv, hono, langchain, @langchain/core, @langchain/openai, openai, pino (+28 more)

### Community 2 - "Intent Routing & Flows"
Cohesion: 0.07
Nodes (36): Billing Runner Env Vars (BILLING_*), CRM Environment Variables (CRM_*, mock-first), Feature Flags (FEATURE_RAG, FEATURE_ACIONAR_ATENDENTE, etc.), SGA Circuit Breaker Config, SGA Environment Variables (SGA_*), SGA Two-Step Auth (SGA_USUARIO/SGA_SENHA), Vittal ADK Configuration Guide, Offline-First Dev Loop (M1-M6) (+28 more)

### Community 3 - "Plugins & Tool Registry"
Cohesion: 0.06
Nodes (34): AppointmentInputSchema, appointmentTool, crmClient, CrmGetContactInputSchema, crmGetContactTool, CrmLogInteractionInputSchema, crmLogInteractionTool, CrmUpsertLeadInputSchema (+26 more)

### Community 4 - "Firecrawl Scraper Integration"
Cohesion: 0.11
Nodes (30): Example API Base URL (https://api.example.com/v1), GET /resources Endpoint, get_resources Tool, Example Client Harness Integration, Example Client Integration Spec, Example Client Integration Roadmap, Example Client Integration Tasklist, Example Client Tools Schema (+22 more)

### Community 5 - "Manifest & Capabilities"
Cohesion: 0.07
Nodes (11): AGENT_CAPABILITIES, AGENT_CAPABILITY_MIN_LEVEL, AGENT_LEVEL_ORDER, AGENT_LEVELS, AgentCapability, AgentCapabilityLevelViolation, AgentLevel, AgentManifestPluginRef (+3 more)

### Community 6 - "Biome Lint Config"
Cohesion: 0.08
Nodes (24): files, ignore, formatter, enabled, indentStyle, indentWidth, lineWidth, quoteStyle (+16 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, allowJs, lib, module, moduleDetection, moduleResolution, noEmit (+16 more)

### Community 8 - "ADK Spec & Process"
Cohesion: 0.14
Nodes (23): ADK Simplicity Principle (no Clean Architecture layers), Agent Context Isolation (no context leakage between agents), Agent Manifest (agent.manifest.json), Bun Native TypeScript Tests (bun test), Cloudflare Tunnel for Local Webhook Exposure, ADK Core Engine (config, manifest, ProcessMessage), FAQ / Informational Query Flow, Human Handoff Rule (escalation trigger) (+15 more)

### Community 9 - "CRM Client (mock-first)"
Cohesion: 0.13
Nodes (11): circuitBreaker, CrmCircuitBreaker, CrmClient, CrmContact, CrmIntegrationError, CrmInteraction, CrmLead, normalizeCrmCpf() (+3 more)

### Community 10 - "README & Principles"
Cohesion: 0.12
Nodes (21): Cloudflare Tunnel (local dev webhook exposure), Core Engine (src/core/), create-agent Script, Hono Server (src/presentation/server.ts), ProcessMessage.ts — Main Message Orchestrator, RAG Architecture (Retrieval-Augmented Generation), Service Adapters (src/services/), UAZAPI WhatsApp Webhook Integration (+13 more)

### Community 11 - "AprovaAuto Integration Specs"
Cohesion: 0.17
Nodes (21): Circuit Breaker (3 failures/60s → open 120s), AprovaAuto CLAUDE.md — Integration Developer Manual, AprovaAuto HARNESS_INTEGRATION.md — Test Scenarios, AprovaAuto INTEGRATION_SPEC.md, LGPD CPF↔Plate Bind Rule (hard gate), AprovaAuto Raw Docs (Scraped Hinova SGA API v2), AprovaAuto ROADMAP.md, AprovaAuto Roadmap Phase 1: Core Read (Safe) (+13 more)

### Community 12 - "UAT Transcripts & Debriefing"
Cohesion: 0.17
Nodes (19): AprovaAuto Debriefing to PRD and Specs, Gestão Financeira e Cobrança Inteligente, Jailbreak and Prompt Injection Resilience Behaviors, Atendimento Comercial Inteligente para Leads, LGPD CPF+Plate Dual Validation Rule, Persona Test Scenarios (7 behavioral archetypes), License Plate Normalization (abc-1d23 → ABC1D23), Proteção Veicular (Vehicle Protection Product) (+11 more)

### Community 13 - "Agent Scaffolding"
Cohesion: 0.14
Nodes (15): copyAndFillTemplate(), description, envExample, envFilled, fail(), log(), manifest, ok() (+7 more)

### Community 14 - "WhatsApp Simulator Server"
Cohesion: 0.13
Nodes (16): agentDir, argv, fallback, faqPath, getSession(), handleMessage(), makeSession(), manifest (+8 more)

### Community 15 - "ProcessMessage & Config"
Cohesion: 0.24
Nodes (9): AppConfig, config, configSchema, logger, IncomingMessageDTO, PreparedChunk, RagChunkResult, RagQueryResult (+1 more)

### Community 16 - "Server Bootstrap"
Cohesion: 0.13
Nodes (11): loadManifest(), createServer(), messageBuffers, messageTimers, processedIds, WebhookPayload, WebhookPayloadSchema, app (+3 more)

### Community 17 - "UAT Simulator Harness"
Cohesion: 0.12
Nodes (13): agentDir, argv, C, fallback, faqPath, manifest, provider, Scenario (+5 more)

### Community 18 - "OpenAI Provider"
Cohesion: 0.19
Nodes (9): AIResponse, AIToolingResponse, CompleteWithToolsRequest, computeCost(), Message, OpenAIProvider, PRICING_TABLE, Tool (+1 more)

### Community 20 - "Message Orchestration Core"
Cohesion: 0.20
Nodes (3): AgentManifest, ProcessMessage, HandoffService

### Community 21 - "M1 Integration & Routing"
Cohesion: 0.22
Nodes (11): Circuit Breaker + Handoff em Falha, CrmClient.ts, Integração CRM (mock-first), Roteamento por Intenção, Documentação real do CRM (Lucas), M1 — Integração (SGA + CRM) & Roteamento por Intenção, Agente Orquestrador (level: orchestrator), SgaClient.ts (+3 more)

### Community 22 - "Roadmap & Modules"
Cohesion: 0.22
Nodes (11): M3 — Gestão Financeira e Cobrança Inteligente, tool_sga_get_financial_invoice (2ª via), Métricas (resolução, handoff, LGPD, conversão, inadimplência), M6 — Monitoramento e Evolução Contínua, Logs do Vittal Hub, Fase 2 — M3 cobrança ativa + M4 FAQ, Gate Dia 60 (testes assistidos pré go-live), Gate Dia 90 (otimização e evolução) (+3 more)

### Community 23 - "Package Metadata"
Cohesion: 0.18
Nodes (10): author, description, keywords, license, name, scripts, crawl, scrape (+2 more)

### Community 24 - "Proactive Billing Workers"
Cohesion: 0.28
Nodes (9): Follow-up de Pendências Documentais, scripts/billing-runner.ts (worker de cobrança), Dokploy Schedule / Cron (scheduler), Endpoints reais Hinova (boletos/situação/vencimento), Idempotência de Disparo (.billing-cache), Janela de Carência D+1, RabbitMQPublisher, Régua de Cobrança (+1 more)

### Community 26 - "M5 Commercial / Leads"
Cohesion: 0.25
Nodes (8): tool_crm_log_interaction, tool_crm_upsert_lead, Gatilhos de Urgência/Oferta, M5 — Atendimento Comercial Inteligente para Leads, Qualificação Inteligente de Lead (stage), Resumo Estruturado → Consultor, Separação de Canais (comercial vs operacional), tool_sga_simulate_quote

### Community 27 - "M2 Claims (placa-unidade)"
Cohesion: 0.25
Nodes (8): M2 — Atendimento de Sinistro, Placa → Unidade Responsável, tool_sga_create_claim, tool_sga_get_claim_status, tool_sga_search_vehicle, tool_sga_upload_claim_document, Verificação da Base de Seguros / Cobertura, Fase 3 — M2 placa→unidade + M5 qualificação

### Community 29 - "RabbitMQ Message Types"
Cohesion: 0.25
Nodes (7): PublishButtonsContent, PublishDocumentContent, PublishImageContent, PublishListContent, PublishMessage, PublishRecipient, PublishTextContent

### Community 30 - "Conversation Repo Models"
Cohesion: 0.25
Nodes (7): Conversation, Execution, ExecutionLogInput, ExecutionResult, ExecutionStepInput, Message, SaveMessageInput

### Community 31 - "M4 Member Service / FAQ"
Cohesion: 0.33
Nodes (7): Categorização da FAQ (sinistro/comercial/associado), human_handoff, Ingestão da Planilha de Q&A da Jaine, LangChainRag (RAG local), M4 — Atendimento Inteligente ao Associado, ProcessMessage (áudio Whisper + visão), Revisão Periódica de Conversas

### Community 32 - "CI/CD Workflow"
Cohesion: 0.40
Nodes (6): Dokploy Deployment Platform, CI Workflow (GitHub Actions), CI Lint Job, CI Test Job, Deploy Workflow (GitHub Actions), Deploy → Dokploy (aprovauto-ai) Job

### Community 33 - "Process Helpers"
Cohesion: 0.40
Nodes (4): getActiveTools(), buildPhoneWhitelistSet(), getPhoneWhitelistKeys(), normalizePhoneIdentifier()

### Community 34 - "RAG Vectorizer"
Cohesion: 0.40
Nodes (4): agentDir, args, envPath, rag

### Community 36 - "Docker / Dokploy Deploy"
Cohesion: 0.83
Nodes (4): AprovaAuto AI Docker Service, Dokploy Network (external Docker network), Traefik Reverse Proxy Routing (aprovauto-ai.vittalweb.com), Docker Compose Configuration

### Community 40 - "CRM Plugin & Tools"
Cohesion: 0.67
Nodes (3): Plugin custom.crm, plugins.ts (tool registry), tool_crm_get_contact

## Knowledge Gaps
- **265 isolated node(s):** `name`, `version`, `description`, `type`, `scrape` (+260 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `config` connect `ProcessMessage & Config` to `SGA Client & Billing`, `Plugins & Tool Registry`, `CRM Client (mock-first)`, `Server Bootstrap`, `OpenAI Provider`, `RabbitMQ Message Types`, `Conversation Repo Models`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `RestConversationRepository` connect `Conversation Repository` to `Message Orchestration Core`, `Conversation Repo Models`, `ProcessMessage & Config`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `SgaClient` connect `SGA Client & Billing` to `Plugins & Tool Registry`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _272 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SGA Client & Billing` be split into smaller, more focused modules?**
  _Cohesion score 0.06734006734006734 - nodes in this community are weakly interconnected._
- **Should `Dependencies & Scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Intent Routing & Flows` be split into smaller, more focused modules?**
  _Cohesion score 0.0746031746031746 - nodes in this community are weakly interconnected._