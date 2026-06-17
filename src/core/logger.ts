import pino from 'pino'
import { config } from './config'

export const logger = pino({
  level: config.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'openaiApiKey',
      'hubApiKey',
      'hubAgentKey',
      'webhookSecret',
      'uazapiToken',
      'outboundUazapiToken',
      'crmBearerToken',
      'headers.authorization',
      'headers.Authorization',
      '*.token',
      '*.apiKey',
      '*.bearerToken',
    ],
    censor: '[redacted]',
  },
  transport: config.logPretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        },
      }
    : undefined,
})
