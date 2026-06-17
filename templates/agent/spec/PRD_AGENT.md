# PRD_AGENT.md
# Product Requirements Document - Agent Spec

## 1. Identidade do agente

- Cliente: `[NOME DA EMPRESA]`
- Canal: `whatsapp | webchat | instagram_dm`
- Nome interno do agente: `[SLUG]`

## 2. Objetivo do agente

Descreva em 3–5 linhas o que o agente faz e, principalmente, o que ele NÃO faz.

## 3. Usuários e casos de uso

Liste:
- Tipos de usuário (cliente final, lead, etc.)
- 3–5 casos de uso principais:
  - Ex.: "Consultar disponibilidade de produto X"
  - Ex.: "Consultar dados básicos de cadastro no CRM"

## 4. Escopo e limites

- Escopo:
  - O agente responde sobre:
    - ...
- Fora de escopo:
  - O agente NÃO responde sobre:
    - ...

## 5. Integrações e ferramentas

- Ferramentas necessárias:
  - `human_handoff` (transfere para humano)
  - `appointment_request_notification` (notifica agendamento)
- Regras:
  - Em caso de erro da ferramenta, responder com mensagem amigável.

## 6. Tom e estilo

- Idioma: Português do Brasil.
- Estilo: Cordial, objetivo, profissional.

## 7. Fluxos principais (referência a `flows.md`)

- `flows.md` deve detalhar:
  - Fluxo de consulta.
  - Fluxo de encaminhamento para humano.

## 8. Exemplos de conversas (referência a `examples.md`)

- `examples.md` deve conter diálogos com comportamentos esperados.

## 9. Critérios de sucesso do agente

- Metas: % de respostas dentro do escopo, nenhum vazamento de dados, conformidade nos testes.
