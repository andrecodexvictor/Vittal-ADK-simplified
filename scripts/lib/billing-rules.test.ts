import { describe, expect, test } from 'bun:test'
import type { SgaBoletoListItem } from '../../src/services/SgaClient'
import { buildMessage, classify, parseDue, shouldRemind } from './billing-rules'

const TODAY = new Date(2026, 5, 22) // 22/06/2026 (mês 0-based)
const OPTS = { graceDays: 2, preventiveLeadDays: 3, recentOverdueDays: 7 }

function due(daysFromToday: number): Date {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + daysFromToday)
  return d
}

describe('régua de cobrança — classify (estágios + janela D+1)', () => {
  test('preventivo exatamente N dias antes do vencimento', () => {
    expect(classify(due(3), TODAY, OPTS)).toBe('preventivo')
  })

  test('não notifica antes do lead preventivo', () => {
    expect(classify(due(2), TODAY, OPTS)).toBeNull()
    expect(classify(due(10), TODAY, OPTS)).toBeNull()
  })

  test('janela D+1: não cobra quem venceu há ≤ graceDays (baixa manual)', () => {
    expect(classify(due(0), TODAY, OPTS)).toBeNull() // vence hoje
    expect(classify(due(-1), TODAY, OPTS)).toBeNull() // 1 dia vencido
    expect(classify(due(-2), TODAY, OPTS)).toBeNull() // 2 dias = grace
  })

  test('vencido_recente entre grace+1 e recentOverdueDays', () => {
    expect(classify(due(-3), TODAY, OPTS)).toBe('vencido_recente')
    expect(classify(due(-7), TODAY, OPTS)).toBe('vencido_recente')
  })

  test('vencido além do limite recente', () => {
    expect(classify(due(-8), TODAY, OPTS)).toBe('vencido')
    expect(classify(due(-30), TODAY, OPTS)).toBe('vencido')
  })
})

describe('parseDue', () => {
  test('aceita yyyy-mm-dd e dd/mm/yyyy', () => {
    expect(parseDue('2026-06-10')?.getFullYear()).toBe(2026)
    expect(parseDue('10/06/2026')?.getDate()).toBe(10)
    expect(parseDue('')).toBeNull()
  })
})

describe('shouldRemind — cadência anti-spam (1 msg por estágio; vencido repete a cada 7d)', () => {
  test('nunca enviado → envia', () => {
    expect(shouldRemind(undefined, 'preventivo', TODAY)).toBe(true)
    expect(shouldRemind(undefined, 'vencido', TODAY)).toBe(true)
  })

  test('preventivo e vencido_recente NÃO repetem (mesmo dias depois)', () => {
    expect(shouldRemind('2026-06-10', 'preventivo', TODAY)).toBe(false)
    expect(shouldRemind('2026-06-01', 'vencido_recente', TODAY)).toBe(false)
  })

  test('vencido só repete após o intervalo de 7 dias', () => {
    expect(shouldRemind('2026-06-21', 'vencido', TODAY)).toBe(false) // ontem
    expect(shouldRemind('2026-06-16', 'vencido', TODAY)).toBe(false) // 6 dias
    expect(shouldRemind('2026-06-15', 'vencido', TODAY)).toBe(true) // 7 dias
    expect(shouldRemind('2026-06-01', 'vencido', TODAY)).toBe(true)
  })

  test('ledger corrompido (data inválida) → envia em vez de silenciar', () => {
    expect(shouldRemind('not-a-date', 'vencido', TODAY)).toBe(true)
  })
})

describe('buildMessage — tom suave + formas de pagamento', () => {
  const base: SgaBoletoListItem = {
    invoiceId: '778899',
    dueDate: '2026-06-10',
    amount: 145,
    status: 'ABERTO',
    boletoPdfUrl: 'https://sga/boleto.pdf',
    barcode: '00190.00009',
    associadoName: 'Carlos Eduardo Silva',
  }

  test('inclui nome, valor, link do boleto e linha digitável', () => {
    const msg = buildMessage(base, 'vencido_recente')
    expect(msg).toContain('Carlos')
    expect(msg).toContain('R$ 145,00')
    expect(msg).toContain('https://sga/boleto.pdf')
    expect(msg).toContain('00190.00009')
  })

  test('não menciona Pix quando a fatura não traz pixCopyPaste', () => {
    expect(buildMessage(base, 'preventivo')).not.toContain('Pix')
  })

  test('inclui Pix copia e cola somente quando disponível', () => {
    const withPix = { ...base, pixCopyPaste: '00020126...PIX' }
    expect(buildMessage(withPix, 'vencido')).toContain('Pix copia e cola')
  })

  test('preventivo tem tom amigável de lembrete', () => {
    expect(buildMessage(base, 'preventivo').toLowerCase()).toContain('lembrar')
  })
})
