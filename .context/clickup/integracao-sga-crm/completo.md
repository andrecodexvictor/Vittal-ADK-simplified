# Integração com Sistemas — SGA / CRM

**Status ClickUp:** Testar internamente  
**Situação:** SGA implementado; CRM em modo simulado

## Objetivo

Conectar os agentes aos sistemas da AprovaAuto e identificar a intenção do cliente antes de direcionar o atendimento.

## Entregue — SGA Hinova v2

- Autenticação em duas etapas e renovação após falha.
- Busca de veículo por placa.
- Busca paginada por marca/modelo.
- Seleção do modelo mais compatível.
- Simulação de cotação.
- Consulta de boletos e situação financeira.
- Validação conjunta de CPF e placa.
- Abertura de sinistro.
- Upload de documentos e imagens.
- Consulta de andamento do sinistro.
- Verificação de cobertura ativa.
- Leitura do código regional do veículo.
- Timeout, circuit breaker e handoff em falhas reais.

## Entregue — CRM

- Contrato inicial da integração.
- Consulta de contato por telefone.
- Criação e atualização de lead.
- Registro de etapa do funil.
- Registro do resumo da interação.
- Tratamento seguro de falha.
- Mock determinístico para testes offline.

## Entregue — roteamento

- Classificação em Comercial, Financeiro, Sinistro, Associado ou Humano.
- Atendimento sem menu numérico obrigatório.
- Uso do contexto anterior e da placa.
- Priorização de pedido humano/cancelamento.
- Suporte a múltiplas intenções.

## Pendente

- Receber documentação e credenciais do CRM real.
- Mapear campos, estágios e duplicidade do CRM.
- Substituir o mock pelo CRM produtivo.
- Confirmar permissões e códigos operacionais do SGA.
- Executar homologação integrada.
- Definir filas e responsáveis de handoff.
- Testar timeout, indisponibilidade e recuperação em homologação.

## Critérios de aceite

- SGA real respondendo aos fluxos autorizados.
- CRM real criando e atualizando leads.
- Intenções roteadas corretamente.
- Nenhum erro técnico ou dado sensível exposto.
- Handoff entregue à área correta.
- Evidências de UAT anexadas no ClickUp.

## Estimativa

- Homologação SGA: 3–5 dias úteis.
- CRM real: 5–8 dias úteis.
- Testes integrados: 3–5 dias úteis.

