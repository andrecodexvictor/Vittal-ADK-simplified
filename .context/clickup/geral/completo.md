# Relatório geral completo — Agentes AprovaAuto

**Data-base:** 03/07/2026  
**Status:** Testar internamente  
**Público:** equipes técnica, operacional e gestora

## Resumo

Estão implementadas quatro frentes: Integração SGA/CRM, Comercial, Associado e Sinistro. O código passou em 30 testes automatizados, com 0 falhas e 87 verificações. O lint validou 130 arquivos sem erros.

Implementado não significa homologado. Antes da produção ainda são necessários números definitivos, instâncias UAZAPI separadas, homologação das integrações, UAT, conteúdo oficial e definição das equipes humanas.

## Estrutura para números diferentes

| Agente | Número | Finalidade | Handoff |
|---|---|---|---|
| Comercial | A definir | Leads, cotação e vendas | Consultores comerciais |
| Associado | A definir | FAQ, financeiro e serviços | Atendimento/financeiro |
| Sinistro | A definir | Abertura e acompanhamento | Sinistro/unidade regional |

A integração SGA/CRM é compartilhada e não precisa de número próprio. Cada agente operacional deverá ter UAZAPI, webhook, chave do Hub, deploy, origem, prompt, ferramentas e atendentes isolados.

## Plataforma já entregue

- Webhook autenticado para WhatsApp.
- Texto, áudio, transcrição e imagem.
- Deduplicação, debounce e processamento serial por conversa.
- OpenAI com histórico e chamadas de ferramentas.
- RAG/base de conhecimento com cache.
- Handoff humano com pausa do agente.
- Persistência de mensagens, execuções, tokens e custos no Hub.
- Envio por RabbitMQ/UAZAPI.
- Timeout, circuit breaker e tratamento de falhas.
- LGPD no fluxo financeiro.
- Docker, Dokploy, Traefik e CI/CD.
- Mocks, testes automatizados e simuladores de UAT.

## Status por agente

### Integração SGA/CRM

SGA Hinova v2 implementado para autenticação, veículos, cotação, financeiro e sinistro. CRM possui contrato e ferramentas em modo simulado. Falta integrar e homologar o CRM real, confirmar acessos e realizar testes integrados.

### Comercial

Já identifica leads, consulta veículo, simula cotação, coleta dados, registra lead no CRM simulado e transfere para consultor. Falta número próprio, CRM real, funil definitivo, resumo padronizado e UAT.

### Associado

Já responde FAQ, processa áudio/imagem, consulta segunda via com CPF + placa e transfere casos inseguros. Falta número próprio, conteúdo oficial categorizado, aprovação do tom e UAT.

### Sinistro

Já coleta dados, valida cobertura, abre ocorrência, envia documentos e consulta status. Falta número próprio, mapa regional, handoff por unidade, lembretes documentais e UAT real.

## Entregas adicionais

Existe um worker de cobrança com dry-run, carência D+1, estágios, idempotência local e testes. Antes da produção faltam aprovação do financeiro, agendamento, validação real e persistência durável.

O Hub já recebe dados operacionais, mas ainda falta painel com resolução, handoff, tempo de resposta, falhas, conversão, cobrança e incidentes LGPD.

## Critérios gerais para produção

- Entrada e saída funcionando no número correto.
- Contexto, ferramentas e handoff isolados por agente.
- Integrações reais homologadas.
- Conteúdo e tom aprovados.
- Dados pessoais protegidos.
- Testes e lint verdes.
- UAT com evidências no ClickUp.
- Responsável operacional e plano de rollback definidos.

## Dependências externas

1. Três números de WhatsApp e seus administradores.
2. Instâncias/acessos UAZAPI.
3. Documentação e credenciais do CRM.
4. Credenciais e permissões definitivas do SGA.
5. Planilha oficial de perguntas e respostas.
6. Mapa regional de sinistro.
7. Atendentes e responsáveis pelo aceite de cada frente.

