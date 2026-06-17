import { expect, test, describe, beforeAll, mock } from 'bun:test'
import { join } from 'node:path'

// 1. Mock OpenAIProvider so no live API calls are made during unit tests
mock.module('../../../src/services/OpenAIProvider', () => {
  return {
    OpenAIProvider: class {
      async complete() {
        return {
          text: 'Olá! Como posso ajudar você hoje na Clínica Bela Pele?',
          inputTokens: 10,
          outputTokens: 15,
          totalTokens: 25,
          estimatedCostUsd: 0.0001,
        }
      }
      async completeWithTools() {
        return {
          text: 'Estou chamando a recepção para você.',
          inputTokens: 15,
          outputTokens: 20,
          totalTokens: 35,
          estimatedCostUsd: 0.0002,
          invocations: [],
        }
      }
    },
  }
})

// 2. Mock RabbitMQPublisher to capture outbound messages
const publishedMessages: any[] = []
mock.module('../../../src/services/RabbitMQ', () => {
  return {
    RabbitMQPublisher: class {
      async publish(phone: string, text: string) {
        publishedMessages.push({ phone, text })
      }
      async close() {}
    },
  }
})

// 3. Mock RestConversationRepository to run completely offline
mock.module('../../../src/services/RestConversationRepository', () => {
  return {
    RestConversationRepository: class {
      async resolve(phone: string) {
        return { id: 'test-conv-bela-pele', agentId: 'test-agent-bela-pele', contactIdentifier: phone, status: 'active', channel: 'whatsapp' }
      }
      async getAgentState() {
        return { isPaused: () => false, toString: () => 'active' }
      }
      async saveMessage() {
        return { id: 'msg-123', conversationId: 'test-conv-bela-pele', role: 'user', content: 'teste', createdAt: new Date() }
      }
      async getHistory() {
        return []
      }
      async createExecution() {
        return { id: 'exec-123', conversationId: 'test-conv-bela-pele', status: 'created' }
      }
      async addStep() {}
      async addLog() {}
      async finalizeExecution() {}
    },
  }
})

// 4. Import ProcessMessage after the mocks have been established
import { ProcessMessage } from '../../../src/core/ProcessMessage'
import { loadManifest } from '../../../src/core/manifest'

describe('Clinica Bela Pele WhatsApp Agent Tests', () => {
  let processMessage: ProcessMessage

  beforeAll(() => {
    process.env.NODE_ENV = 'test'
    process.env.AGENT_DIR = join(process.cwd(), 'agents', 'clinica-bela-pele', 'whatsapp')
    
    // Set mock keys to pass Zod schema validation
    process.env.WEBHOOK_SECRET = 'test-secret-key'
    process.env.HUB_AGENT_KEY = 'test-agent-key'
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.RABBITMQ_URL = 'amqp://localhost'
    process.env.RABBITMQ_EXCHANGE = 'test-exchange'
    process.env.RABBITMQ_ROUTING_KEY = 'test-key'
    process.env.UAZAPI_TOKEN = 'test-uazapi-token'

    const manifest = loadManifest(process.env.AGENT_DIR)
    processMessage = new ProcessMessage(manifest, process.env.AGENT_DIR)
  })

  test('should process welcome message successfully and reply with the mocked response', async () => {
    publishedMessages.length = 0

    await processMessage.execute({
      chatId: '5511999999999@c.us',
      sender: '5511999999999@c.us',
      senderPhone: '5511999999999',
      text: 'Olá, gostaria de saber quais procedimentos vocês realizam',
      messageId: 'msg-test-bela-pele',
      instanceName: 'uazapi-instance',
      isGroup: false,
    })

    expect(publishedMessages.length).toBe(1)
    expect(publishedMessages[0].text).toContain('Clínica Bela Pele')
  })
})
