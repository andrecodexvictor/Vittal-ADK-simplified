import { config } from '../core/config'
import { logger } from '../core/logger'

export class HandoffService {
  private attendants: string[] = []
  private currentIndex = 0

  constructor() {
    this.attendants = config.handoffAttendants
      .split(',')
      .map((num) => num.trim())
      .filter((num) => num.length > 0)
  }

  /**
   * Retrieves the next attendant in round-robin order.
   */
  getNextAttendant(): string | null {
    if (this.attendants.length === 0) {
      return null
    }
    const attendant = this.attendants[this.currentIndex] ?? null
    this.currentIndex = (this.currentIndex + 1) % this.attendants.length
    return attendant
  }

  getAllAttendants(): string[] {
    return this.attendants
  }

  /**
   * Pauses the agent. This blocks the agent from responding to further webhook messages.
   */
  async pauseAgent(conversationId: string, repository: any): Promise<void> {
    try {
      await repository.setAgentState(conversationId, {
        toString: () => 'paused',
        isPaused: () => true,
      })
      logger.info({ conversationId }, 'Agent paused successfully')
    } catch (err) {
      logger.error({ err, conversationId }, 'Failed to pause agent')
    }
  }

  /**
   * Unpauses the agent.
   */
  async unpauseAgent(conversationId: string, repository: any): Promise<void> {
    try {
      await repository.setAgentState(conversationId, {
        toString: () => 'active',
        isPaused: () => false,
      })
      logger.info({ conversationId }, 'Agent unpaused successfully')
    } catch (err) {
      logger.error({ err, conversationId }, 'Failed to unpause agent')
    }
  }
}
