import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Contrato do roteamento por intenção (offline).
 *
 * O roteamento real é executado pelo LLM em runtime; sua validação COMPORTAMENTAL
 * (intenção certa por mensagem) vive no loop de UAT `scripts/simulate-agent.ts`,
 * que usa o LLM real. Aqui garantimos o CONTRATO do prompt: que a seção de
 * roteamento existe e cobre as cinco frentes, as regras-chave e as tools de CRM.
 * Isso impede que uma edição futura remova silenciosamente o roteamento.
 */
const agentDir = join(process.cwd(), 'agents', 'aprovauto-ai', 'whatsapp')
const systemPrompt = readFileSync(join(agentDir, 'prompts', 'system.md'), 'utf8')

describe('Contrato de roteamento por intenção no system.md', () => {
  test('possui a seção de roteamento por intenção', () => {
    expect(systemPrompt).toContain('ROTEAMENTO POR INTENÇÃO')
  })

  test('cobre as cinco frentes de intenção', () => {
    for (const intent of [
      'cotacao_comercial',
      'financeiro_cobranca',
      'sinistro',
      'associado_faq',
      'humano',
    ]) {
      expect(systemPrompt).toContain(intent)
    }
  })

  test('proíbe menu numérico rígido e identifica intenção antes de transferir', () => {
    expect(systemPrompt).toContain('Não apresente menu numérico rígido')
    expect(systemPrompt).toContain('Identifique a intenção antes de qualquer transferência')
  })

  test('usa contexto de placa para inferir a frente', () => {
    expect(systemPrompt.toLowerCase()).toContain('placa')
    expect(systemPrompt).toContain('unidade')
  })

  test('referencia as tools de CRM no fluxo comercial', () => {
    for (const tool of ['tool_crm_upsert_lead', 'tool_crm_log_interaction', 'tool_crm_get_contact']) {
      expect(systemPrompt).toContain(tool)
    }
  })
})
