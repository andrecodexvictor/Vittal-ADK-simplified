import { hkdfSync, createHmac, createDecipheriv } from 'node:crypto'
import OpenAI, { toFile } from 'openai'
import { config } from '../core/config'

export class MediaService {
  private readonly openaiClient: OpenAI

  constructor() {
    this.openaiClient = new OpenAI({ apiKey: config.openaiApiKey })
  }

  /**
   * Decrypts encrypted WhatsApp PTT audio files (.enc files from the CDN).
   * Uses HKDF-SHA256 with an empty salt and "WhatsApp Audio Keys" info.
   */
  decryptWhatsAppAudio(encBuffer: Buffer, mediaKeyBase64: string): Buffer {
    const mediaKey = Buffer.from(mediaKeyBase64, 'base64')

    // HKDF-SHA256 with empty salt and "WhatsApp Audio Keys" info -> 112 bytes
    const expanded = Buffer.from(
      hkdfSync('sha256', mediaKey, Buffer.alloc(0), Buffer.from('WhatsApp Audio Keys'), 112),
    )

    const iv = expanded.subarray(0, 16)
    const decKey = expanded.subarray(16, 48)
    const macKey = expanded.subarray(48, 80)

    if (encBuffer.length < 10) {
      throw new Error('WhatsApp audio buffer too small to contain MAC')
    }

    const ciphertext = encBuffer.subarray(0, encBuffer.length - 10)
    const fileMac = encBuffer.subarray(encBuffer.length - 10)

    // Integrity check: HMAC-SHA256 of IV || ciphertext using macKey (first 10 bytes)
    const computedMac = createHmac('sha256', macKey)
      .update(iv)
      .update(ciphertext)
      .digest()
      .subarray(0, 10)

    if (!computedMac.equals(fileMac)) {
      throw new Error('WhatsApp audio MAC verification failed (corrupted file or incorrect mediaKey)')
    }

    // AES-256-CBC decryption
    const decipher = createDecipheriv('aes-256-cbc', decKey, iv)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  /**
   * Transcribes an OGG/Opus audio buffer using OpenAI Whisper API.
   */
  async transcribeAudio(buffer: Buffer): Promise<string> {
    const file = await toFile(buffer, 'audio.ogg', { type: 'audio/ogg' })

    const transcription = await this.openaiClient.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'pt',
    })

    return transcription.text
  }
}
