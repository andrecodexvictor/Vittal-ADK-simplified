import OpenAI from 'openai'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { config } from '../core/config'

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_call_id?: string
}

export interface Tool {
  name: string
  description: string
  inputSchema: z.ZodType<any>
  execute(input: any, context?: any): Promise<any>
}

export interface ToolInvocationRecord {
  toolName: string
  input: any
  output: any
  status: 'success' | 'error'
  error?: string
}

export interface AIResponse {
  text: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
}

export interface AIToolingResponse extends AIResponse {
  invocations: ToolInvocationRecord[]
}

export interface CompleteWithToolsRequest {
  systemPrompt: string
  history: Message[]
  userMessage: string
  tools: Tool[]
  executeTool: (name: string, args: any) => Promise<ToolInvocationRecord>
  imageUrl?: string
  maxIterations?: number
}

// Cost estimation utility based on models pricing (USD per 1M tokens)
const PRICING_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
}

function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING_TABLE[model] || PRICING_TABLE['gpt-4o-mini']!
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output
}

export class OpenAIProvider {
  private readonly client: OpenAI

  constructor() {
    this.client = new OpenAI({ apiKey: config.openaiApiKey })
  }

  async complete(
    systemPrompt: string,
    history: Message[],
    userMessage: string,
    imageUrl?: string,
  ): Promise<AIResponse> {
    const userContent: string | OpenAI.Chat.ChatCompletionContentPart[] = imageUrl
      ? [
          { type: 'text', text: userMessage.trim() || 'Analise a imagem enviada pelo usuario.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ]
      : userMessage

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userContent },
    ]

    const response = await this.client.chat.completions.create({
      model: config.openaiModel,
      max_tokens: config.openaiMaxTokens,
      temperature: config.openaiTemperature,
      top_p: config.openaiTopP,
      messages,
    })

    const choice = response.choices[0]
    if (!choice) throw new Error('OpenAI returned no choices')

    const text = choice.message?.content ?? ''
    const usage = response.usage
    const inputTokens = usage?.prompt_tokens ?? 0
    const outputTokens = usage?.completion_tokens ?? 0

    return {
      text,
      inputTokens,
      outputTokens,
      totalTokens: usage?.total_tokens ?? inputTokens + outputTokens,
      estimatedCostUsd: computeCost(config.openaiModel, inputTokens, outputTokens),
    }
  }

  async completeWithTools(request: CompleteWithToolsRequest): Promise<AIToolingResponse> {
    const invocations: ToolInvocationRecord[] = []
    
    const tools: OpenAI.Chat.ChatCompletionTool[] = request.tools.map((tool) => {
      const jsonSchema = zodToJsonSchema(tool.inputSchema as z.ZodType, { target: 'draft-7' })
      const { $schema: _, ...parameters } = jsonSchema as any
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters,
        },
      }
    })

    const userContent: string | OpenAI.Chat.ChatCompletionContentPart[] = request.imageUrl
      ? [
          {
            type: 'text',
            text: request.userMessage.trim() || 'Analise a imagem enviada pelo usuario.',
          },
          { type: 'image_url', image_url: { url: request.imageUrl } },
        ]
      : request.userMessage

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      ...request.history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userContent },
    ]

    const maxIterations = request.maxIterations ?? 5
    let inputTokens = 0
    let outputTokens = 0

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const response = await this.client.chat.completions.create({
        model: config.openaiModel,
        max_tokens: config.openaiMaxTokens,
        temperature: config.openaiTemperature,
        top_p: config.openaiTopP,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
      })

      inputTokens += response.usage?.prompt_tokens ?? 0
      outputTokens += response.usage?.completion_tokens ?? 0

      const choice = response.choices[0]
      if (!choice) throw new Error('OpenAI returned no choices')
      const assistantMessage = choice.message
      messages.push(assistantMessage as OpenAI.Chat.ChatCompletionAssistantMessageParam)

      const toolCalls = assistantMessage.tool_calls ?? []
      if (toolCalls.length === 0) {
        const text = assistantMessage.content ?? ''
        if (!text.trim()) throw new Error('OpenAI returned an empty final response')
        const totalTokens = inputTokens + outputTokens
        return {
          text,
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCostUsd: computeCost(config.openaiModel, inputTokens, outputTokens),
          invocations,
        }
      }

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue
        let args: any
        try {
          args = JSON.parse(toolCall.function.arguments || '{}')
        } catch {
          args = {}
        }
        
        const invocation = await request.executeTool(toolCall.function.name, args)
        invocations.push(invocation)
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(invocation.output ?? null),
        })
      }
    }

    throw new Error(`Modelo excedeu o limite de ${maxIterations} iteracoes de tool calling`)
  }
}
