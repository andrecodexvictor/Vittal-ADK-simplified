import { Hono } from 'hono'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { config } from '../core/config'
import { logger } from '../core/logger'
import type { ProcessMessage } from '../core/ProcessMessage'

// 1. Zod schemas for UAZAPI webhook validation
export const WebhookPayloadSchema = z.object({
  BaseUrl: z.string().optional().default(''),
  token: z.string().optional().default(''),
  EventType: z.string().optional().default(''),
  message: z
    .object({
      id: z.string(),
      text: z.string().optional(),
      type: z.string(),
      mediaType: z.string().optional(),
      messageType: z.string().optional(),
      fromMe: z.boolean(),
      sender: z.string(),
      sender_pn: z.string().optional(),
      chatid: z.string(),
      senderName: z.string().optional(),
      mediaKey: z.string().optional(),
      content: z
        .union([
          z.object({
            URL: z.string().optional(),
            url: z.string().optional(),
            directPath: z.string().optional(),
            mimetype: z.string().optional(),
            mediaKey: z.string().optional(),
          }),
          z.string().transform(() => undefined),
        ])
        .optional(),
    })
    .optional(),
  chat: z
    .object({
      wa_isGroup: z.boolean().optional().default(false),
    })
    .optional(),
  instanceName: z.string().optional().default(''),
})

type WebhookPayload = z.infer<typeof WebhookPayloadSchema>

// Deduplication cache
const processedIds = new Map<string, number>()
const DEDUP_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours
setInterval(() => {
  const now = Date.now()
  for (const [id, ts] of processedIds) {
    if (now - ts > DEDUP_TTL_MS) processedIds.delete(id)
  }
  for (const [phone, until] of antispamMutedUntil) {
    if (now >= until) antispamMutedUntil.delete(phone)
  }
  for (const [phone, hits] of antispamHits) {
    if (hits.every((t) => now - t >= HOUR_MS)) antispamHits.delete(phone)
  }
}, 30 * 60 * 1000)

// Debouncing maps
const messageBuffers = new Map<string, string[]>()
const messageTimers = new Map<string, Timer>()

// Anti-spam: duas janelas deslizantes por remetente — rajada (60s) e sustentada (1h,
// pega loops bot-a-bot lentos); excedeu qualquer uma → mute temporário.
// ponytail: limites em memória por processo — mover p/ Redis se houver múltiplas réplicas
const ANTISPAM_MAX_PER_MIN = Number(process.env.ANTISPAM_MAX_PER_MIN || 10)
const ANTISPAM_MAX_PER_HOUR = Number(process.env.ANTISPAM_MAX_PER_HOUR || 30)
const ANTISPAM_MUTE_MS = Number(process.env.ANTISPAM_MUTE_MINUTES || 30) * 60_000
const HOUR_MS = 60 * 60_000
const antispamHits = new Map<string, number[]>()
const antispamMutedUntil = new Map<string, number>()

/** Retorna true se o remetente deve ser bloqueado (spam). Exportada para teste. */
export function isSpamming(senderPhone: string, now = Date.now()): boolean {
  const muted = antispamMutedUntil.get(senderPhone)
  if (muted !== undefined) {
    if (now < muted) return true
    antispamMutedUntil.delete(senderPhone)
  }

  const hits = (antispamHits.get(senderPhone) ?? []).filter((t) => now - t < HOUR_MS)
  hits.push(now)
  antispamHits.set(senderPhone, hits)

  const lastMinute = hits.filter((t) => now - t < 60_000).length
  if (lastMinute > ANTISPAM_MAX_PER_MIN || hits.length > ANTISPAM_MAX_PER_HOUR) {
    antispamMutedUntil.set(senderPhone, now + ANTISPAM_MUTE_MS)
    antispamHits.delete(senderPhone)
    logger.warn(
      { senderPhone, hitsLastMinute: lastMinute, hitsLastHour: hits.length, muteMinutes: ANTISPAM_MUTE_MS / 60_000 },
      'Anti-spam: remetente silenciado temporariamente',
    )
    return true
  }
  return false
}

// Constant-time token verification to prevent timing attacks
function validateToken(token: string, secret: string): boolean {
  if (!token || !secret) return false
  try {
    const a = Buffer.from(token.padEnd(secret.length))
    const b = Buffer.from(secret.padEnd(token.length))
    const maxLen = Math.max(a.length, b.length)
    const aNorm = Buffer.alloc(maxLen)
    const bNorm = Buffer.alloc(maxLen)
    a.copy(aNorm)
    b.copy(bNorm)
    return timingSafeEqual(aNorm, bNorm) && token.length === secret.length
  } catch {
    return false
  }
}

function resolveMediaUrl(payload: WebhookPayload): string | null {
  const msg = payload.message
  if (!msg || !msg.content || typeof msg.content === 'string') return null

  const contentUrl = msg.content.URL ?? msg.content.url
  if (contentUrl?.trim()) return contentUrl

  const directPath = msg.content.directPath
  const baseUrl = payload.BaseUrl
  if (directPath?.trim() && baseUrl?.trim()) {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
    const normalizedDirectPath = directPath.startsWith('/') ? directPath : `/${directPath}`
    return `${normalizedBaseUrl}${normalizedDirectPath}`
  }

  return null
}

export function createServer(processMessage: ProcessMessage): Hono {
  const app = new Hono()

  // Request logging middleware
  app.use('*', async (c, next) => {
    const start = Date.now()
    await next()
    const elapsed = Date.now() - start
    logger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, elapsedMs: elapsed },
      'HTTP Request',
    )
  })

  // Health check endpoint
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // Webhook endpoint
  app.post('/webhook', async (c) => {
    let body: any
    try {
      body = await c.req.json()
    } catch {
      return c.json({ ok: false, error: 'Invalid JSON' }, 400)
    }

    // 1. Authenticate webhook request
    const queryToken = c.req.query('token')
    const parsedPayload = WebhookPayloadSchema.safeParse(body)
    const bodyToken = parsedPayload.success ? parsedPayload.data.token : ''

    if (!validateToken(bodyToken, config.webhookSecret) && !validateToken(queryToken || '', config.webhookSecret)) {
      logger.warn('Webhook rejected — invalid authentication token')
      return c.json({ ok: true }, 200) // Return 200 to prevent webhook retry loop
    }

    if (!parsedPayload.success) {
      return c.json({ ok: true, reason: 'ignored-invalid-payload' })
    }

    const payload = parsedPayload.data
    const msg = payload.message

    if (payload.EventType !== 'messages' || !msg || msg.fromMe) {
      return c.json({ ok: true, reason: 'ignored-event-type-or-sender' })
    }

    // 2. Deduplication check
    if (processedIds.has(msg.id)) {
      logger.info({ messageId: msg.id }, 'Duplicate message detected — ignoring')
      return c.json({ ok: true })
    }
    processedIds.set(msg.id, Date.now())

    const isGroup = payload.chat?.wa_isGroup ?? false
    const senderPhone = msg.sender_pn ?? (isGroup ? msg.sender : msg.chatid)

    // Anti-spam: descarta antes de qualquer download de mídia ou chamada de IA
    if (isSpamming(senderPhone)) {
      return c.json({ ok: true, reason: 'rate-limited' })
    }

    // 3. Media Download (Audio/Image)
    const isAudio = msg.type === 'media' && (msg.mediaType === 'ptt' || msg.messageType === 'AudioMessage')
    const isImage = msg.type === 'media' && (msg.mediaType === 'image' || msg.messageType === 'ImageMessage')

    if (isAudio) {
      const mediaUrl = resolveMediaUrl(payload)
      if (!mediaUrl) return c.json({ ok: true, reason: 'ignored-audio-without-url' })

      // Download audio binary asynchronously to process immediately
      fetch(mediaUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP status ${res.status}`)
          return res.arrayBuffer()
        })
        .then((arrayBuffer) => {
          const audioBuffer = Buffer.from(arrayBuffer)
          const audioMediaKey = typeof msg.content === 'object' ? msg.content?.mediaKey ?? msg.mediaKey : msg.mediaKey
          
          processMessage.execute({
            chatId: msg.chatid,
            sender: msg.sender,
            senderPhone,
            text: '',
            messageId: msg.id,
            instanceName: payload.instanceName,
            isGroup,
            contactName: msg.senderName,
            mediaType: 'audio',
            audioBuffer,
            audioMediaKey,
          }).catch((err) => logger.error({ err }, 'Error processing audio message'))
        })
        .catch((err) => logger.error({ err, messageId: msg.id }, 'Failed to download WhatsApp audio'))

      return c.json({ ok: true })
    }

    if (isImage) {
      const mediaUrl = resolveMediaUrl(payload)
      if (!mediaUrl) return c.json({ ok: true, reason: 'ignored-image-without-url' })

      // Convert image to Base64 data URI asynchronously
      fetch(mediaUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP status ${res.status}`)
          const mimetype = typeof msg.content === 'object' ? msg.content?.mimetype : undefined
          const contentType = res.headers.get('content-type') ?? mimetype ?? 'image/jpeg'
          return res.arrayBuffer().then((ab) => ({ base64: Buffer.from(ab).toString('base64'), contentType }))
        })
        .then(({ base64, contentType }) => {
          processMessage.execute({
            chatId: msg.chatid,
            sender: msg.sender,
            senderPhone,
            text: msg.text?.trim() ?? '',
            messageId: msg.id,
            instanceName: payload.instanceName,
            isGroup,
            contactName: msg.senderName,
            mediaType: 'image',
            imageUrl: `data:${contentType};base64,${base64}`,
            imageMimeType: contentType,
          }).catch((err) => logger.error({ err }, 'Error processing image message'))
        })
        .catch((err) => logger.error({ err, messageId: msg.id }, 'Failed to download WhatsApp image'))

      return c.json({ ok: true })
    }

    // 4. Standard text message flow (utilizes Debounce)
    if (msg.type !== 'text' || !msg.text?.trim()) {
      return c.json({ ok: true, reason: 'ignored-non-processable' })
    }

    const textMsg = msg.text.trim()
    const chatKey = msg.chatid

    // Debounce accumulation
    const buffer = messageBuffers.get(chatKey) ?? []
    buffer.push(textMsg)
    messageBuffers.set(chatKey, buffer)

    const existingTimer = messageTimers.get(chatKey)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(async () => {
      const msgs = messageBuffers.get(chatKey) ?? []
      messageBuffers.delete(chatKey)
      messageTimers.delete(chatKey)

      const consolidatedText = msgs.join('\n').trim()
      if (!consolidatedText) return

      try {
        await processMessage.execute({
          chatId: msg.chatid,
          sender: msg.sender,
          senderPhone,
          text: consolidatedText,
          messageId: msg.id,
          instanceName: payload.instanceName,
          isGroup,
          contactName: msg.senderName,
        })
      } catch (err) {
        logger.error({ err, chatId: msg.chatid }, 'Error processing debounced text message')
      }
    }, config.debounceMs)

    messageTimers.set(chatKey, timer)

    return c.json({ ok: true })
  })

  return app
}
