# Atendimento de Sinistro

**Status ClickUp:** Testar internamente  
**Número de WhatsApp:** A definir; deverá ser exclusivo

## Objetivo

Receber a comunicação do sinistro, validar cobertura, coletar informações, anexar documentos, consultar o andamento e encaminhar para a unidade responsável.

## Entregue

- Identificação da intenção de sinistro.
- Coleta de CPF, placa, data/hora, local e descrição.
- Pergunta sobre terceiros envolvidos.
- Verificação de cobertura ativa.
- Bloqueio quando não há cobertura válida.
- Abertura da ocorrência no SGA.
- Recebimento do protocolo.
- Upload de CNH, CRLV e fotos de avarias.
- Consulta por protocolo ou placa.
- Tratamento de indisponibilidade.
- Handoff humano seguro.
- Testes de abertura, upload, status e cobertura.

## Pendente

- Criar o agente `aprovauto-sinistro`.
- Configurar número, UAZAPI, Hub e deploy próprios.
- Receber o mapa de regionais.
- Relacionar código regional à unidade/equipe.
- Direcionar o handoff para a unidade correta.
- Definir escala e contingência humana.
- Criar lembretes de documentos pendentes.
- Testar múltiplos documentos e mídias reais.
- Testar terceiros, falta de cobertura e dados divergentes.
- Testar indisponibilidade do SGA.
- Validar prazos informados ao associado.
- Criar métricas de abertura e resolução.

## Critérios de aceite

- Cobertura validada antes da abertura.
- Sinistro registrado corretamente.
- Documentos associados ao protocolo correto.
- Unidade responsável identificada.
- Handoff entregue à equipe correta.
- Dados de terceiros protegidos.
- Contingência e número exclusivo validados.

## Estimativa

- Separação/configuração: 3–4 dias úteis.
- Regional/handoff: 3–5 dias úteis.
- UAT e correções: 4–6 dias úteis.

