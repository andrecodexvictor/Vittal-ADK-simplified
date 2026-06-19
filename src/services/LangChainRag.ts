import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Document } from '@langchain/core/documents'
import { OpenAIEmbeddings } from '@langchain/openai'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { logger } from '../core/logger'
import { config } from '../core/config'

export interface RawDocument {
  source: string
  content: string
}

export interface PreparedChunk {
  text: string
  source: string
  section?: string
}

export interface RagChunkResult {
  text: string
  source: string
  section?: string
  score: number
}

export interface RagQueryResult {
  chunks: RagChunkResult[]
  embeddingTokens: number
  embeddingCostUsd: number
}

// Simple breakpoint-based Markdown and text chunker
export function chunkDocuments(
  docs: RawDocument[],
  maxChars = 1000,
  overlap = 100,
): PreparedChunk[] {
  const chunks: PreparedChunk[] = []

  for (const doc of docs) {
    const lines = doc.content.split(/\r?\n/)
    const sections: Array<{ heading?: string; body: string }> = []
    let currentHeading: string | undefined
    let buffer: string[] = []

    const flush = () => {
      const body = buffer.join('\n').trim()
      if (body.length > 0) {
        sections.push({ heading: currentHeading, body })
      }
      buffer = []
    }

    for (const line of lines) {
      const headingMatch = /^#{1,6}\s+(.+)$/.exec(line)
      if (headingMatch) {
        flush()
        currentHeading = headingMatch[1]?.trim()
        continue
      }
      buffer.push(line)
    }
    flush()

    const activeSections = sections.length > 0 ? sections : [{ body: doc.content.trim() }]

    for (const section of activeSections) {
      const text = section.body
      if (text.length <= maxChars) {
        if (text.length > 0) {
          chunks.push({ text, source: doc.source, section: section.heading })
        }
        continue
      }

      let start = 0
      while (start < text.length) {
        const tentativeEnd = Math.min(start + maxChars, text.length)
        let end = tentativeEnd

        if (end < text.length) {
          const windowStr = text.slice(start, end)
          const candidates = ['\n\n', '. ', '\n', '! ', '? ']
          let breakAt = -1
          for (const candidate of candidates) {
            const idx = windowStr.lastIndexOf(candidate)
            if (idx > 0) {
              breakAt = start + idx + candidate.length
              break
            }
          }
          if (breakAt > start) {
            end = breakAt
          }
        }

        const chunkText = text.slice(start, end).trim()
        if (chunkText.length > 0) {
          chunks.push({ text: chunkText, source: doc.source, section: section.heading })
        }

        if (end >= text.length) {
          break
        }
        start = Math.max(end - overlap, start + 1)
      }
    }
  }

  return chunks
}

export class LangChainRag {
  private vectorStore: MemoryVectorStore | null = null
  private isLoaded = false
  private readonly knowledgeDir: string
  private readonly cacheDir: string
  private readonly modelName = 'text-embedding-3-small'

  constructor(agentDir: string) {
    this.knowledgeDir = path.join(agentDir, 'knowledge')
    this.cacheDir = path.join(this.knowledgeDir, '.rag-cache')
  }

  private computeHash(text: string): string {
    return createHash('sha256').update(`${this.modelName}::${text}`).digest('hex')
  }

  private async loadCache(): Promise<Map<string, number[]>> {
    try {
      const cacheFile = path.join(this.cacheDir, 'embeddings.json')
      const raw = await fs.readFile(cacheFile, 'utf-8')
      const parsed = JSON.parse(raw) as { model: string; entries: Array<{ hash: string; vector: number[] }> }
      if (parsed.model !== this.modelName) {
        return new Map()
      }
      const map = new Map<string, number[]>()
      for (const entry of parsed.entries) {
        map.set(entry.hash, entry.vector)
      }
      return map
    } catch {
      return new Map()
    }
  }

  private async saveCache(entries: Map<string, number[]>): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
      const cacheFile = path.join(this.cacheDir, 'embeddings.json')
      const payload = {
        model: this.modelName,
        entries: [...entries.entries()].map(([hash, vector]) => ({ hash, vector })),
      }
      await fs.writeFile(cacheFile, JSON.stringify(payload), 'utf-8')
    } catch (err) {
      logger.error({ err }, 'RAG: Falha ao gravar cache de embeddings em disco')
    }
  }

  async query(text: string, topK = 3): Promise<RagQueryResult> {
    if (!this.isLoaded) {
      await this.loadKnowledgeBase()
    }

    if (!this.vectorStore) {
      return { chunks: [], embeddingTokens: Math.max(1, Math.ceil(text.length / 4)), embeddingCostUsd: 0 }
    }

    const queryTokens = Math.max(1, Math.ceil(text.length / 4))
    const queryCost = (queryTokens / 1_000_000) * 0.02 // text-embedding-3-small price

    const results = await this.vectorStore.similaritySearchWithScore(text, topK)
    const chunks = results.map(([doc, score]) => ({
      text: doc.pageContent,
      source: typeof doc.metadata?.source === 'string' ? doc.metadata.source : 'unknown',
      section: typeof doc.metadata?.section === 'string' ? doc.metadata.section : undefined,
      score,
    }))

    return {
      chunks,
      embeddingTokens: queryTokens,
      embeddingCostUsd: queryCost,
    }
  }

  private async loadKnowledgeBase(): Promise<void> {
    this.isLoaded = true
    try {
      const exists = await fs.access(this.knowledgeDir).then(() => true).catch(() => false)
      if (!exists) {
        logger.warn({ path: this.knowledgeDir }, 'RAG: Pasta knowledge ausente; RAG desabilitado')
        return
      }

      const entries = await fs.readdir(this.knowledgeDir)
      const docs: RawDocument[] = []

      for (const entry of entries) {
        const lower = entry.toLowerCase()
        if (lower.endsWith('.md') || lower.endsWith('.txt')) {
          const fullPath = path.join(this.knowledgeDir, entry)
          const content = await fs.readFile(fullPath, 'utf-8')
          docs.push({ source: entry, content })
        }
      }

      if (docs.length === 0) {
        logger.warn({ path: this.knowledgeDir }, 'RAG: Nenhum documento found; RAG retornará vazio')
        return
      }

      const chunks = chunkDocuments(docs)
      if (chunks.length === 0) {
        logger.warn('RAG: Nenhum chunk gerado dos documentos')
        return
      }

      logger.info({ docs: docs.length, chunks: chunks.length }, 'RAG: Carregando cache e resolvendo embeddings...')

      const cachedMap = await this.loadCache()
      const embeddings = new OpenAIEmbeddings({
        apiKey: config.openaiApiKey,
        modelName: this.modelName,
      })

      const resolvedVectors: number[][] = new Array(chunks.length)
      const missingIndexes: number[] = []
      const missingTexts: string[] = []

      for (let i = 0; i < chunks.length; i++) {
        // biome-ignore lint/style/noNonNullAssertion: index bounded by chunks.length
        const chunk = chunks[i]!
        const hash = this.computeHash(chunk.text)
        const hit = cachedMap.get(hash)
        if (hit) {
          resolvedVectors[i] = hit
        } else {
          missingIndexes.push(i)
          missingTexts.push(chunk.text)
        }
      }

      if (missingTexts.length > 0) {
        logger.info({ missCount: missingTexts.length }, 'RAG: Buscando novos embeddings via OpenAI...')
        const freshVectors = await embeddings.embedDocuments(missingTexts)
        for (let i = 0; i < missingIndexes.length; i++) {
          // biome-ignore lint/style/noNonNullAssertion: bounded by missingIndexes.length
          const idx = missingIndexes[i]!
          // biome-ignore lint/style/noNonNullAssertion: freshVectors has same length as missingIndexes
          const vec = freshVectors[i]!
          resolvedVectors[idx] = vec

          // biome-ignore lint/style/noNonNullAssertion: idx is a valid chunks index
          const chunk = chunks[idx]!
          cachedMap.set(this.computeHash(chunk.text), vec)
        }
        await this.saveCache(cachedMap)
      }

      const langchainDocs = chunks.map((chunk, idx) => new Document({
        pageContent: chunk.text,
        metadata: { source: chunk.source, section: chunk.section, index: idx },
      }))

      const store = new MemoryVectorStore(embeddings)
      await store.addVectors(resolvedVectors, langchainDocs)
      this.vectorStore = store
      logger.info('RAG: Base de conhecimento carregada com sucesso')
    } catch (err) {
      logger.error({ err }, 'RAG: Falha crítica ao inicializar base de conhecimento')
    }
  }
}
