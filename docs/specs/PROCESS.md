# PROCESS.md - Fluxo de Trabalho do ADK

## 1. Criar novo agente

Execute na raiz do projeto:
```bash
bun run create-agent "Nome do Cliente" "Descricao opcional" "whatsapp"
```
Isso criará a pasta `agents/nome-do-cliente/whatsapp/` contendo prompts, configurações e um exemplo de teste em TypeScript.

## 2. Configurar o agente

1. Edite `agents/nome-do-cliente/whatsapp/prompts/system.md` para definir a persona, o escopo e as regras do agente.
2. Defina os documentos em `agents/nome-do-cliente/whatsapp/knowledge/` (se for usar RAG).
3. Preencha as credenciais no arquivo `agents/nome-do-cliente/whatsapp/.env`.
4. Defina as regras e plugins em `agents/nome-do-cliente/whatsapp/agent.manifest.json`.

## 3. Testar localmente

Rode os testes em TypeScript puro da pasta do agente usando:
```bash
bun test agents/nome-do-cliente/whatsapp/tests/
```
Você pode criar múltiplos arquivos de teste para cobrir fluxos de FAQ, RAG, Handoff e cenários de segurança.

## 4. Rodar em desenvolvimento

Para iniciar a execução local apontando especificamente para o agente:
```bash
bun dev --agent nome-do-cliente
```
A porta default é a `3000`. Use Cloudflare Tunnels para expor o servidor local para receber os webhooks do WhatsApp (UAZAPI):
```bash
cloudflared tunnel --url http://localhost:3000
```
Copie a URL HTTPS gerada pela Cloudflare e insira no campo de Webhook da sua instância no UAZAPI.
