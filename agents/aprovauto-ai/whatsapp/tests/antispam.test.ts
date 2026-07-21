import { describe, expect, test } from 'bun:test'
import { isSpamming } from '../../../../src/presentation/server'

/**
 * Anti-spam (offline): janela deslizante de 60s, máx 10 msgs/min, mute de 30 min.
 * Telefones distintos por caso — o estado é por remetente em memória de módulo.
 */
const T0 = Date.now()

describe('isSpamming', () => {
  test('10 mensagens no mesmo minuto não bloqueiam', () => {
    for (let i = 0; i < 10; i++) {
      expect(isSpamming('5511900000001', T0 + i * 1000)).toBe(false)
    }
  })

  test('a 11ª mensagem no mesmo minuto bloqueia', () => {
    for (let i = 0; i < 10; i++) {
      expect(isSpamming('5511900000002', T0 + i * 1000)).toBe(false)
    }
    expect(isSpamming('5511900000002', T0 + 10_000)).toBe(true)
  })

  test('permanece bloqueado dentro do período de mute', () => {
    for (let i = 0; i < 11; i++) {
      isSpamming('5511900000003', T0 + i * 1000)
    }
    expect(isSpamming('5511900000003', T0 + 5 * 60_000)).toBe(true)
  })

  test('após o mute expirar volta a aceitar', () => {
    for (let i = 0; i < 11; i++) {
      isSpamming('5511900000004', T0 + i * 1000)
    }
    expect(isSpamming('5511900000004', T0 + 31 * 60_000)).toBe(false)
  })
})
