import { hostname } from 'node:os'
import pino, { type DestinationStream, type Logger } from 'pino'
import pretty from 'pino-pretty'

export type { Logger }

/** Where the lines of a logger go: standard output, unless a test reads them. */
export type LogDestination = DestinationStream

export type LoggerSettings = {
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
  /** `json` writes one object per line; `pretty` is for reading in a terminal. */
  format: 'json' | 'pretty'
  /** Written on every line, to tell environments apart where logs are collected. */
  environment: string
}

/** Written synchronously, so that the last lines before an exit are not lost. */
const standardOutput = (format: LoggerSettings['format']): LogDestination =>
  format === 'pretty'
    ? pretty({ colorize: true, sync: true })
    : pino.destination({ dest: 1, sync: true })

/**
 * The application's structured logger. Lines go to standard output, where
 * the platform that runs the process collects them.
 */
export const createLogger = (
  { level, format, environment }: LoggerSettings,
  destination: LogDestination = standardOutput(format),
): Logger =>
  pino(
    {
      level,
      base: { environment, hostname: hostname(), pid: process.pid },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
    },
    destination,
  )
