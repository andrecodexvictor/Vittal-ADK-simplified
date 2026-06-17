# Flows - Clinica Bela Pele

## Flow 1: FAQ / Informational Queries
- **Trigger**: User asks about procedures, business hours, prices, or address.
- **Action**: Check RAG knowledge database and reply directly in Portuguese.

## Flow 2: Human Attendant Handoff
- **Trigger**: User asks for a human, wants to schedule an appointment, or shows dissatisfaction.
- **Action**: Inform that a receptionist will continue the chat, then execute the `human_handoff` tool.
