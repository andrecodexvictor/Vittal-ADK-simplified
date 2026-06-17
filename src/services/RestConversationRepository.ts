import { config } from '../core/config'
import { logger } from '../core/logger'

export interface SaveMessageInput {
  role: 'user' | 'assistant'
  content: string
  senderName?: string
  senderPhone?: string
  executionId?: string
  sourceId?: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
  senderName?: string
  senderPhone?: string
  executionId?: string
}

export interface Conversation {
  id: string
  agentId: string
  contactIdentifier: string
  contactName?: string
  channel: string
  status: string
}

export interface Execution {
  id: string
  conversationId: string
  status: string
}

export interface ExecutionStepInput {
  index: number
  nodeType: string
  name: string
  inputs?: any
  outputs?: any
  status: 'running' | 'success' | 'error'
  elapsedMs: number
  tokenUsage?: number
  cost?: number
}

export interface ExecutionLogInput {
  level: 'info' | 'warn' | 'error'
  message: string
  data?: any
}

export interface ExecutionResult {
  status: 'success' | 'error'
  outputs?: any
  tokens?: number
  promptTokens?: number
  completionTokens?: number
  cost?: number
  elapsedMs: number
}

export class RestConversationRepository {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>

  constructor() {
    this.baseUrl = config.hubBaseUrl
    this.headers = {
      'Content-Type': 'application/json',
      'X-Agent-Key': config.hubAgentKey,
    }
    if (config.hubApiKey) {
      this.headers['X-API-Key'] = config.hubApiKey
    }
  }

  private async request<T>(method: string, path: string, body?: object): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Hub API ${method} ${path} → ${res.status}: ${text}`)
    }

    return res.json() as Promise<T>
  }

  async resolve(
    contactIdentifier: string,
    channel: string,
    contactName?: string,
  ): Promise<Conversation> {
    const data = await this.request<any>(
      'POST',
      '/api/ai-hub/conversations/resolve',
      { contact_identifier: contactIdentifier, channel, contact_name: contactName },
    )
    return {
      id: String(data.id ?? ''),
      agentId: String(data.agent_id ?? ''),
      contactIdentifier,
      contactName,
      channel,
      status: String(data.status ?? 'active'),
    }
  }

  async getHistory(conversationId: string, limit = 20): Promise<Message[]> {
    try {
      const data = await this.request<any[]>(
        'GET',
        `/api/ai-hub/conversations/${conversationId}/messages?limit=${limit}`,
      )
      return (data ?? []).map((m) => ({
        id: String(m.id ?? ''),
        conversationId,
        role: (m.role as 'user' | 'assistant') ?? 'user',
        content: String(m.content ?? ''),
        createdAt: new Date(String(m.created_at ?? new Date())),
        senderName: m.sender_name ? String(m.sender_name) : undefined,
        senderPhone: m.sender_phone ? String(m.sender_phone) : undefined,
        executionId: m.execution_id ? String(m.execution_id) : undefined,
      }))
    } catch (err) {
      logger.error({ err, conversationId }, 'RAG: Falha ao obter histórico do Hub')
      return []
    }
  }

  async saveMessage(conversationId: string, input: SaveMessageInput): Promise<Message> {
    try {
      const data = await this.request<any>(
        'POST',
        `/api/ai-hub/conversations/${conversationId}/messages`,
        {
          role: input.role,
          content: input.content,
          content_type: 'text',
          sender_name: input.senderName,
          sender_phone: input.senderPhone,
          execution_id: input.executionId,
          source_id: input.sourceId,
        },
      )
      return {
        id: String(data.id ?? ''),
        conversationId,
        role: input.role,
        content: input.content,
        createdAt: new Date(),
      }
    } catch (err) {
      logger.error({ err, conversationId }, 'Failed to save message to Hub')
      return {
        id: `local-${Date.now()}`,
        conversationId,
        role: input.role,
        content: input.content,
        createdAt: new Date(),
      }
    }
  }

  async createExecution(data: {
    conversationId?: string
    contactIdentifier?: string
    triggeredFrom: string
    inputs?: object
  }): Promise<Execution> {
    const tryCreate = async (includeConvId: boolean): Promise<any> => {
      const body: Record<string, unknown> = {
        contact_identifier: data.contactIdentifier,
        triggered_from: data.triggeredFrom,
        inputs: data.inputs,
      }
      if (includeConvId && data.conversationId) {
        body.conversation_id = data.conversationId
      }
      return this.request<any>('POST', '/api/ai-hub/executions', body)
    }

    try {
      const response = await tryCreate(true)
      return {
        id: String(response.id ?? ''),
        conversationId: data.conversationId ?? '',
        status: String(response.status ?? 'created'),
      }
    } catch (firstErr) {
      try {
        const response = await tryCreate(false)
        return {
          id: String(response.id ?? ''),
          conversationId: data.conversationId ?? '',
          status: String(response.status ?? 'created'),
        }
      } catch (secondErr) {
        logger.error({ secondErr }, 'createExecution failed completely')
        return {
          id: `local-${Date.now()}`,
          conversationId: data.conversationId ?? '',
          status: 'created',
        }
      }
    }
  }

  async addStep(executionId: string, step: ExecutionStepInput): Promise<void> {
    if (executionId.startsWith('local-')) return
    try {
      await this.request('POST', `/api/ai-hub/executions/${executionId}/steps`, {
        index: step.index,
        node_type: step.nodeType,
        name: step.name,
        inputs: step.inputs,
        outputs: step.outputs,
        status: step.status,
        elapsed_time_ms: step.elapsedMs,
        token_usage: step.tokenUsage,
        cost: step.cost,
      })
    } catch (err) {
      logger.warn({ err, executionId }, 'Failed to add execution step')
    }
  }

  async addLog(executionId: string, log: ExecutionLogInput): Promise<void> {
    if (executionId.startsWith('local-')) return
    try {
      await this.request('POST', `/api/ai-hub/executions/${executionId}/logs`, {
        level: log.level,
        message: log.message,
        data: log.data,
      })
    } catch (err) {
      logger.warn({ err, executionId }, 'Failed to add execution log')
    }
  }

  async finalizeExecution(executionId: string, result: ExecutionResult): Promise<void> {
    if (executionId.startsWith('local-')) return
    try {
      await this.request('PATCH', `/api/ai-hub/executions/${executionId}`, {
        status: result.status,
        outputs: result.outputs,
        total_tokens: result.tokens,
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
        cost: result.cost,
        elapsed_time_ms: result.elapsedMs,
      })
    } catch (err) {
      logger.warn({ err, executionId }, 'Failed to finalize execution')
    }
  }

  async getAgentState(conversationId: string): Promise<{ isPaused: () => boolean; toString: () => string }> {
    try {
      const data = await this.request<{ data: { metadata?: { agent_state?: string } } }>(
        'GET',
        `/api/ai-hub/conversations/${conversationId}`,
      )
      const stateValue = data.data?.metadata?.agent_state ?? 'active'
      return {
        isPaused: () => stateValue === 'paused',
        toString: () => stateValue,
      }
    } catch {
      return {
        isPaused: () => false,
        toString: () => 'active',
      }
    }
  }

  async setAgentState(conversationId: string, state: { toString: () => string }): Promise<void> {
    try {
      await this.request('PATCH', `/api/ai-hub/conversations/${conversationId}`, {
        metadata: { agent_state: state.toString() },
      })
    } catch (err) {
      logger.error({ err, conversationId }, 'Failed to set agent state')
    }
  }
}
