# Próximos passos e planejamento do ClickUp

## Alteração necessária para múltiplos números

1. Criar `aprovauto-comercial`, `aprovauto-associado` e `aprovauto-sinistro`.
2. Reutilizar o core e as integrações SGA/CRM.
3. Separar manifestos, prompts, conhecimento e ferramentas.
4. Criar três serviços no Dokploy.
5. Criar três agentes/chaves no Vittal Hub.
6. Criar uma instância UAZAPI por número.
7. Separar origens, rotas e listas de handoff.
8. Testar que nenhum agente acessa contexto ou ferramentas de outro.

## Cronograma estimado

Estimativa para um desenvolvedor principal, apoio parcial de DevOps e dependências disponíveis.

| Etapa | Esforço | Janela sugerida |
|---|---:|---|
| Confirmar números, responsáveis, filas e aceite | 1–2 dias úteis | 06–07/07 |
| Separar agentes, prompts e ferramentas | 4–6 dias úteis | 08–15/07 |
| Criar UAZAPI, Hub e deploys | 3–4 dias úteis | 13–17/07 |
| Homologar SGA e mapa regional | 3–5 dias úteis | 16–22/07 |
| Integrar CRM real | 5–8 dias úteis | 16–27/07 |
| Importar FAQ e validar RAG | 3–5 dias úteis | 20–24/07 |
| Executar UAT e correções | 5–7 dias úteis | 27/07–04/08 |
| Piloto controlado | 5 dias úteis | 05–11/08 |
| Go-live gradual | 3–5 dias úteis | 12–18/08 |

## Status sugeridos

`Backlog -> Pronta para desenvolvimento -> Em desenvolvimento -> Revisão técnica -> Testar internamente -> Aguardando cliente -> Piloto -> Pronta para produção -> Concluída`

Use `Bloqueada` para dependências externas.

## Campos sugeridos

- Agente/frente.
- Número de WhatsApp.
- Instância UAZAPI.
- Ambiente.
- Responsável técnico.
- Responsável de negócio.
- Dependência externa.
- Critério de aceite.
- Risco LGPD.
- Prazo.
- Evidência de teste.
- Versão/deploy.

## Épicos

1. Separação por número.
2. Integrações SGA/CRM.
3. Comercial.
4. Associado.
5. Sinistro.
6. Qualidade, piloto e produção.

## Riscos principais

| Risco | Impacto |
|---|---|
| CRM sem documentação/credenciais | Bloqueia homologação Comercial |
| Números/UAZAPI indisponíveis | Bloqueia teste ponta a ponta |
| Q&A não entregue | Limita a precisão do Associado |
| Mapa regional incompleto | Pode gerar handoff incorreto em Sinistro |
| Deploy único | Mistura identidade, contexto e métricas |
| Idempotência local da cobrança | Pode repetir mensagens após reinício |

