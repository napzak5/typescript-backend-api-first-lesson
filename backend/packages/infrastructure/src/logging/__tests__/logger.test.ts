import { describe, expect, it } from 'vitest'
import { createLogger, type LoggerSettings } from '../logger'

const settings: LoggerSettings = {
  level: 'info',
  format: 'json',
  environment: 'test',
}

/** A logger that writes into `lines`, one parsed object per line. */
const createRecordingLogger = (overrides: Partial<LoggerSettings>) => {
  const lines: unknown[] = []
  const logger = createLogger(
    { ...settings, ...overrides },
    { write: (line) => lines.push(JSON.parse(line)) },
  )
  return { logger, lines }
}

describe('createLogger', () => {
  it('should write one object per line with the level as a word', () => {
    const { logger, lines } = createRecordingLogger({})

    logger.info({ salonId: 'salon-1' }, 'Salon created')

    expect(lines).toEqual([
      {
        level: 'info',
        time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
        environment: 'test',
        hostname: expect.any(String),
        pid: process.pid,
        salonId: 'salon-1',
        msg: 'Salon created',
      },
    ])
  })

  it('should drop lines below the configured level', () => {
    const { logger, lines } = createRecordingLogger({ level: 'warn' })

    logger.info('Not written')
    logger.warn('Written')

    expect(lines).toMatchObject([{ level: 'warn', msg: 'Written' }])
  })

  it('should write nothing when the level is silent', () => {
    const { logger, lines } = createRecordingLogger({ level: 'silent' })

    logger.fatal('Not written')

    expect(lines).toEqual([])
  })

  it('should carry the bindings of a child logger on its lines', () => {
    const { logger, lines } = createRecordingLogger({})

    logger.child({ requestId: 'req-1' }).error('Failed')

    expect(lines).toMatchObject([
      { level: 'error', requestId: 'req-1', msg: 'Failed' },
    ])
  })
})
