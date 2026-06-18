# CLAUDE.md — Diretrizes de Desenvolvimento de Agentes

Este arquivo serve como contrato de comportamento e memória de contexto para o agente Claude Code neste repositório.

## 🛠️ Comandos do Projeto

- **Instalação**: `bun install`
- **Desenvolvimento**: `bun run dev --agent <slug>` (inicia o servidor de desenvolvimento apontando para o agente)
- **Produção**: `bun run start --agent <slug>`
- **Novo Agente**: `bun run create-agent "<Nome do Cliente>" "<Descrição>" "[whatsapp]"`
- **Testes (Geral)**: `bun test`
- **Testes (Agente)**: `bun test agents/<slug>/whatsapp/tests`
- **Linting & Formatação**: `bun run lint` (Biome check)
- **Corrigir Linting**: `bun run lint:fix` (Biome check --write)

---

## 🧠 Princípios de Engenharia de Agentes (Skills do Karpathy)

Ao desenvolver ou modificar agentes e o core do ADK, siga estritamente estas diretrizes inspiradas no design de agentes práticos do Andrej Karpathy:

1.  **Pense Antes de Codar (Think Before Coding)**:
    *   **Sem premissas silenciosas**: Se um requisito de negócio ou de integração (ex: APIs do SGA ou CRM) estiver ambíguo, pare, explique as opções possíveis e solicite esclarecimentos.
    *   **Questione o escopo**: Se um fluxo ou funcionalidade proposto for complexo demais ou redundante, proponha a abordagem mais simples e minimalista possível.

2.  **Simplicidade em Primeiro Lugar (Simplicity First)**:
    *   **Zero Boilerplate**: Evite camadas desnecessárias de Clean Architecture ou Domain-Driven Design clássicos. Divida a lógica de forma limpa entre `core/` (regras e orquestração) e `services/` (conexões externas).
    *   **Código Enxuto**: Escreva o mínimo de código necessário para resolver o problema. Não crie abstrações abstratas para casos de uso de um único agente.

3.  **Alterações Cirúrgicas (Surgical Changes)**:
    *   **Foco absoluto**: Modifique exclusivamente o código necessário para a funcionalidade requisitada.
    *   **Sem efeitos colaterais**: Não faça refatorações de código alheio que esteja funcionando perfeitamente. Toda linha alterada deve ter um motivo claro de rastreabilidade na tarefa.

4.  **Execução Orientada a Metas (Goal-Driven Execution)**:
    *   **Crie testes primeiro**: Ao criar novas capacidades, implemente um teste offline no arquivo `.test.ts` correspondente que reproduza o fluxo desejado, e trabalhe para fazê-lo passar.
    *   **Feedback Loops**: Use os testes locais integrados para validar a corretude do processamento de forma offline-first antes de testar em canais de produção.

---

## 📁 Estrutura de Contexto e Referências

- **Especificação do ADK**: [ADK-SPEC.md](file:///docs/specs/ADK-SPEC.md)
- **Template de Especificação de Agente**: [AGENT-SPEC-TEMPLATE.md](file:///docs/specs/AGENT-SPEC-TEMPLATE.md)
- **Processo de Execução**: [PROCESS.md](file:///docs/specs/PROCESS.md)
- **Referência de Configuração**: [CONFIGURACAO.md](file:///CONFIGURACAO.md)
- **Guia Geral**: [README.md](file:///README.md)
- **Regras do Biome**: [biome.json](file:///biome.json)
