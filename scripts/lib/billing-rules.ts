/**
 * billing-rules.ts — Lógica PURA da régua de cobrança (M3), sem I/O nem config,
 * para ser testável offline. Usada por scripts/billing-runner.ts.
 */
import type { SgaBoletoListItem } from '../../src/services/SgaClient'

export type Stage = 'preventivo' | 'vencido_recente' | 'vencido'

export interface ReguaOptions {
  graceDays: number // janela D+1: não cobrar quem venceu há ≤ graceDays (baixa manual)
  preventiveLeadDays: number // lembrete amigável N dias ANTES do vencimento
  recentOverdueDays?: number // limite p/ "vencido_recente" (default 7)
}

export function fmtDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getFullYear()}`
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Parses a Hinova date (yyyy-mm-dd or dd/mm/yyyy, optional time) into a Date at local midnight. */
export function parseDue(value: string): Date | null {
  if (!value) return null
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
  return null
}

export function daysBetween(from: Date, to: Date): number {
  const ms = new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0)
  return Math.round(ms / 86_400_000)
}

/**
 * Classifica um boleto num estágio da régua, ou null = não notificar agora.
 * - preventivo: vence em exatamente preventiveLeadDays.
 * - (janela D+1): vencido há ≤ graceDays → null (pode ter pago; baixa manual).
 * - vencido_recente: vencido entre graceDays+1 e recentOverdueDays.
 * - vencido: vencido além de recentOverdueDays.
 */
export function classify(dueDate: Date, today: Date, opts: ReguaOptions): Stage | null {
  const diff = daysBetween(today, dueDate) // >0 futuro; <0 vencido
  const recentLimit = opts.recentOverdueDays ?? 7

  if (diff === opts.preventiveLeadDays) return 'preventivo'
  if (diff < 0) {
    const overdue = -diff
    if (overdue <= opts.graceDays) return null
    if (overdue <= recentLimit) return 'vencido_recente'
    return 'vencido'
  }
  return null
}

/** Monta a mensagem de tom suave de acordo com o estágio. */
export function buildMessage(item: SgaBoletoListItem, stage: Stage): string {
  const nome = item.associadoName?.split(' ')[0] ?? 'tudo bem'
  const valor = item.amount ? `R$ ${item.amount.toFixed(2).replace('.', ',')}` : 'sua mensalidade'
  const venc = item.dueDate ? parseDue(item.dueDate) : null
  const vencStr = venc ? fmtDate(venc) : ''
  const linha = item.barcode ? `\n\nLinha digitável:\n${item.barcode}` : ''
  const link = item.boletoPdfUrl ? `\n\nBoleto (PDF): ${item.boletoPdfUrl}` : ''
  const pix = item.pixCopyPaste ? `\n\nPix copia e cola:\n${item.pixCopyPaste}` : ''

  if (stage === 'preventivo') {
    return `Oi, ${nome}! 😊 Passando só pra lembrar com carinho que sua mensalidade de ${valor} vence em ${vencStr}. Se já tiver pago, pode desconsiderar.${link}${linha}${pix}`
  }
  if (stage === 'vencido_recente') {
    return `Oi, ${nome}! Notamos que a mensalidade de ${valor} (venc. ${vencStr}) ainda consta em aberto por aqui. Se já pagou, é só desconsiderar — a baixa pode levar 1 dia útil. Qualquer dúvida, estou à disposição.${link}${linha}${pix}`
  }
  return `Oi, ${nome}! Sua mensalidade de ${valor} (venc. ${vencStr}) segue em aberto. Pra manter sua proteção em dia, deixo aqui as formas de pagamento. Se precisar reagendar o vencimento ou conversar, é só me chamar.${link}${linha}${pix}`
}
