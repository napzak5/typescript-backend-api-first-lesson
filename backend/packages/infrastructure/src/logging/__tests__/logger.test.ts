import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('createLogger without a destination', () => {
  /** What is written to standard output, which the test keeps instead. */
  const writtenToStandardOutput = () => {
    const written: string[] = []
    vi.spyOn(fs, 'writeSync').mockImplementation((fd, data) => {
      if (fd === 1) {
        written.push(String(data))
      }
      return Buffer.byteLength(String(data))
    })
    return written
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should write each line of the format json to standard output at once', () => {
    // Arrange
    const written = writtenToStandardOutput()
    const logger = createLogger({ ...settings, format: 'json' })

    // Act
    logger.info({ salonId: 'salon-1' }, 'Salon created')

    // Assert
    expect(written.map((line) => JSON.parse(line))).toMatchObject([
      { level: 'info', salonId: 'salon-1', msg: 'Salon created' },
    ])
  })

  it('should write each line of the format pretty to standard output at once, for a terminal', () => {
    // Arrange
    const written = writtenToStandardOutput()
    const logger = createLogger({ ...settings, format: 'pretty' })

    // Act
    logger.warn({ salonId: 'salon-1' }, 'Salon closed')

    // Assert
    expect(written).toHaveLength(1)
    const [line = ''] = written
    expect(line).toContain('Salon closed')
    expect(line).toContain('salon-1')
    expect(() => JSON.parse(line)).toThrow()
  })
})
