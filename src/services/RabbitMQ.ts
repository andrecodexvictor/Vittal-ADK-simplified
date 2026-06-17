import { Connection, type Publisher } from 'rabbitmq-client'
import { randomUUID } from 'node:crypto'
import { config } from '../core/config'
import { logger } from '../core/logger'

export interface PublishRecipient {
  phone: string
  isGroup: boolean
}

export interface PublishTextContent {
  type: 'text'
  text: string
}

export interface PublishImageContent {
  type: 'image'
  url: string
  caption?: string
}

export interface PublishDocumentContent {
  type: 'document'
  url: string
  filename: string
  caption?: string
}

export interface PublishButtonsContent {
  type: 'buttons'
  text: string
  footer?: string
  buttons: Array<{ id: string; text: string }>
}

export interface PublishListContent {
  type: 'list'
  text: string
  footer?: string
  buttonText: string
  sections: Array<{
    title: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>
}

export interface PublishMessage {
  recipient: PublishRecipient
  instanceName: string
  content: PublishTextContent | PublishImageContent | PublishDocumentContent | PublishButtonsContent | PublishListContent
  token: string
}

export class RabbitMQPublisher {
  private readonly connection: Connection
  private publisher!: Publisher
  private readonly source: string
  private readonly envelopeType: string

  constructor(source: string, envelopeType = 'uazapi') {
    this.source = source
    this.envelopeType = envelopeType

    this.connection = new Connection(config.rabbitmqUrl)

    this.connection.on('error', (err) => {
      logger.error({ err }, 'RabbitMQ connection error')
    })

    this.connection.on('connection', () => {
      logger.info({ envelope: this.envelopeType, source: this.source }, 'RabbitMQ connected')
    })

    this.publisher = this.connection.createPublisher({
      confirm: true,
      maxAttempts: 3,
      exchanges: [{ exchange: config.rabbitmqExchange, type: 'topic', durable: true }],
    })
  }

  async publish(
    phone: string,
    text: string,
    instanceName: string,
    isGroup: boolean,
    token?: string,
  ): Promise<void> {
    const outboundInstanceName = this.resolveOutboundInstanceName(instanceName, isGroup)
    const outboundToken = this.resolveOutboundToken(isGroup, token)

    await this.publishRich({
      recipient: { phone, isGroup },
      instanceName: outboundInstanceName,
      content: { type: 'text', text },
      token: outboundToken,
    })
  }

  async publishRich(message: PublishMessage): Promise<void> {
    const c = message.content
    if (c.type !== 'text') {
      // Direct media sending via HTTP (fallback)
      if (!config.uazapiBaseUrl.trim()) {
        throw new Error(`Rich content of type ${c.type} requires UAZAPI_BASE_URL to send directly via HTTP`)
      }
      await this.sendDirectMedia(message)
      return
    }

    // Text message published to RabbitMQ broker
    const messageId = randomUUID()
    const payload = this.buildEnvelope(message, messageId)

    await this.publisher.send(
      {
        exchange: config.rabbitmqExchange,
        routingKey: config.rabbitmqRoutingKey,
        messageId,
      },
      payload,
    )

    logger.info(
      {
        phone: message.recipient.phone,
        instanceName: message.instanceName,
        envelope: this.envelopeType,
        messageId,
      },
      'Message published to RabbitMQ',
    )
  }

  private buildEnvelope(message: PublishMessage, messageId: string): any {
    if (this.envelopeType === 'crm') {
      return {
        version: '2',
        id: messageId,
        source: this.source,
        client_id: message.instanceName,
        routing_key: config.rabbitmqRoutingKey,
        recipient: {
          phone: message.recipient.phone,
        },
        content: message.content,
        dispatch: {
          token: message.token,
          priority: 'high',
        },
        provider: 'crm',
        provider_config: {
          apiId: config.crmApiId,
          bearerToken: config.crmBearerToken,
          rawPhone: message.recipient.phone,
        },
      }
    }

    // Default to UAZAPI envelope format
    return {
      version: '2',
      id: messageId,
      source: this.source,
      client_id: message.instanceName,
      routing_key: config.rabbitmqRoutingKey,
      recipient: {
        phone: message.recipient.phone,
        type: message.recipient.isGroup ? 'group' : 'individual',
      },
      content: message.content,
      dispatch: {
        token: message.token,
      },
    }
  }

  private async sendDirectMedia(message: PublishMessage): Promise<void> {
    const c = message.content
    const baseUrl = config.uazapiBaseUrl.replace(/\/$/, '')
    let url = ''
    let body: any = {}

    if (c.type === 'image') {
      url = `${baseUrl}/send/media`
      body = {
        number: message.recipient.phone,
        type: 'image',
        file: c.url,
        text: c.caption ?? '',
      }
    } else if (c.type === 'document') {
      url = `${baseUrl}/send/media`
      body = {
        number: message.recipient.phone,
        type: 'document',
        file: c.url,
        docName: c.filename,
        text: c.caption ?? '',
      }
    } else if (c.type === 'buttons') {
      url = `${baseUrl}/send/menu`
      body = {
        number: message.recipient.phone,
        type: 'button',
        text: c.text,
        footerText: c.footer ?? '',
        choices: c.buttons.map((b) => `${b.text}|${b.id}`),
      }
    } else if (c.type === 'list') {
      url = `${baseUrl}/send/menu`
      body = {
        number: message.recipient.phone,
        type: 'list',
        text: c.text,
        footerText: c.footer ?? '',
        buttonText: c.buttonText,
        sections: c.sections.map((sec) => ({
          title: sec.title,
          rows: sec.rows.map((row) => ({
            rowId: row.id,
            title: row.title,
            description: row.description ?? '',
          })),
        })),
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: message.token,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      logger.error({ status: res.status, body: text, phone: message.recipient.phone, kind: c.type }, 'UAZAPI direct media send failed')
      throw new Error(`UAZAPI direct media HTTP ${res.status}: ${text}`)
    }

    logger.info({ phone: message.recipient.phone, kind: c.type }, 'UAZAPI direct media sent')
  }

  async close(): Promise<void> {
    await this.publisher.close()
    await this.connection.close()
  }

  private resolveOutboundInstanceName(instanceName: string, isGroup: boolean): string {
    if (isGroup || config.outboundProvider === 'uazapi') {
      return instanceName
    }
    return config.outboundSource || instanceName
  }

  private resolveOutboundToken(isGroup: boolean, overrideToken?: string): string {
    if (overrideToken) {
      return overrideToken
    }
    return config.uazapiToken
  }
}
