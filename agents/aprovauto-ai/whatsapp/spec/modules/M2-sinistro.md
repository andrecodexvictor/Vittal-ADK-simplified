# M2 — Atendimento de Sinistro

> Fase 3. Núcleo já existe; faltam refinamentos contextuais.

## Spec

**Objetivo.** Abertura guiada e acompanhamento de sinistro via WhatsApp, 24/7, com coleta progressiva, identificação de terceiros, recebimento de imagens/documentos e follow-up de pendências documentais (debriefing §1).

**Já implementado** (`tool_sga_*` em `plugins.ts`):
- `tool_sga_create_claim` — cria a notificação preliminar após CPF, placa, data/hora, local, descrição, terceiros.
- `tool_sga_upload_claim_document` — anexa CNH/CRLV/avarias por `multipart/form-data`, um por vez.
- `tool_sga_get_claim_status` — consulta status por protocolo/claimId ou CPF.
- Fluxos 4.3 e 4.4 no `system.md`; empatia, uma pergunta por vez, prazo de até 48h úteis.

**A adicionar (Fase 3):**
1. **Placa → unidade responsável.** O `tool_sga_search_vehicle` já retorna `codigoRegional` do veículo (mapeado no `SgaClient`) e ele é reaproveitado na cotação. Falta apenas o mapa `codigoRegional → unidade/equipe` e usá-lo para rotear o sinistro à frente certa antes do transbordo.
2. **Verificação da base de seguros.** Confirmar contrato ativo/cobertura do veículo antes de prosseguir com o sinistro, evitando abrir ocorrência para veículo sem cobertura.
3. **Follow-up de pendências documentais.** Lembrete automático de documentos faltantes (CNH/CRLV/avarias) — coordenar com o worker de M3 (mesma infra de disparo proativo).

**LGPD/Segurança.** Não expor dados de terceiros; CPF mascarado em logs (últimos 4 dígitos).

## Tasks

- [x] create/upload/status de sinistro (SGA).
- [x] Fluxos 4.3/4.4 no prompt.
- [ ] Tool/lookup de unidade responsável por placa (SGA `codigo_regional`).
- [ ] Verificação de contrato/cobertura ativa antes de abrir sinistro.
- [ ] Follow-up proativo de pendência documental (usa infra de M3).
- [ ] Cenários de UAT de sinistro com terceiros e upload múltiplo.

## Dev Loop

Segue `../DEV-LOOP.md`. Cenários existentes no simulador: `4.1+4.2` (sinistro completo + upload CNH), `5.1`/`5.2` (status), `X1`/`P4`/`P7` (confuso/idoso). Adicionar cenário de placa→unidade e de veículo sem cobertura quando implementados.
