# Flows - [NOME DA EMPRESA]

This file defines the conversation flow rules and expected agent actions for specific use cases.

## Flow 1: FAQ / Informational Queries
- **Trigger**: User asks about business hours, services, prices, or location.
- **Action**: Check RAG knowledge database and reply directly in Portuguese.
- **Exit**: End of query. Do not offer automated generic help.

## Flow 2: Human Attendant Handoff
- **Trigger**: User asks for a human, or becomes frustrated/aggressive, or presents an out-of-scope query.
- **Action**: Explain that a human will continue the chat, then call the handoff tool.
