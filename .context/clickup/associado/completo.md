# Atendimento ao Associado

**Status ClickUp:** Testar internamente  
**Número de WhatsApp:** A definir; deverá ser exclusivo

## Objetivo

Atender associados, responder dúvidas, auxiliar com serviços financeiros autorizados e transferir casos operacionais para a equipe responsável.

## Entregue

- Atendimento por texto, áudio e imagem.
- Transcrição de áudio.
- FAQ com base de conhecimento/RAG.
- Consulta financeira e segunda via.
- Linha digitável quando autorizada.
- Pix somente quando disponível no retorno.
- Validação obrigatória de CPF + placa.
- Bloqueio quando os dados não pertencem ao mesmo contrato.
- Handoff para divergência ou falta de resposta segura.
- Proteção contra respostas inventadas.
- Atendimento em português brasileiro.

## Proteção LGPD

Nenhum boleto, Pix ou linha digitável deve ser exibido apenas com o CPF. CPF, placa e contrato precisam corresponder. Em caso de divergência, os dados são ocultados e o atendimento é transferido.

## Pendente

- Criar o agente `aprovauto-associado`.
- Configurar número, UAZAPI, Hub e deploy próprios.
- Receber a planilha oficial de perguntas e respostas.
- Categorizar conteúdo em Associado, Comercial e Sinistro.
- Importar e vetorizar o conteúdo.
- Validar perguntas-âncora por categoria.
- Aprovar saudação, tom, horários e políticas.
- Definir assuntos e equipes de handoff.
- Validar áudios, imagens e documentos reais.
- Criar métricas de resolução e transferência.

## Critérios de aceite

- FAQ oficial importado e aprovado.
- Perguntas principais respondidas corretamente.
- Nenhuma resposta factual inventada.
- Dados financeiros protegidos.
- Handoff entregue ao setor correto.
- Funcionamento confirmado no número exclusivo.

## Estimativa

- Separação/configuração: 3–4 dias úteis.
- Conteúdo/RAG: 3–5 dias úteis.
- UAT e ajustes: 3–5 dias úteis.

