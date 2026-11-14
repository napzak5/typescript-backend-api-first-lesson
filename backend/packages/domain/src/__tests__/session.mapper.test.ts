import { describe, expect, it } from 'vitest'
import { SessionReadMapper } from '../mappers/read/session.mapper'
import { type DbSession, sessionIdSchema } from '../models/auth'
import { dataOf, dbSession, SESSION_ID, USER_ID } from './auth-fixtures'

const OTHER_SESSION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c21'
const THIRD_SESSION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c22'

const CURRENT = sessionIdSchema.parse(SESSION_ID)

/** A session with every column set, timestamps as PostgreSQL writes them. */
const storedSession = (overrides: Partial<DbSession> = {}): DbSession =>
  dbSession({
    tokenHash: 'ACCESS-TOKEN-HASH',
    refreshTokenHash: 'REFRESH-TOKEN-HASH',
    ipAddress: '2001:db8::7',
    userAgent: 'SalonApp/1.0 (iPhone)',
    expiresAt: '2026-11-14 18:15:00.5+09',
    refreshExpiresAt: '2026-12-14 09:00:00+00',
    lastActivityAt: '2026-11-14 09:00:00.123456+00',
    createdAt: '2026-11-01 10:00:00+09',
    ...overrides,
  })

describe('SessionReadMapper.toApiSessions', () => {
  it('presents exactly the public columns and whether it is the session of the request, timestamps in ISO 8601 UTC', () => {
    const result = SessionReadMapper.toApiSessions([storedSession()], CURRENT)

    expect(dataOf(result)).toEqual([
      {
        id: SESSION_ID,
        userId: USER_ID,
        ipAddress: '2001:db8::7',
        userAgent: 'SalonApp/1.0 (iPhone)',
        expiresAt: '2026-11-14T09:15:00.500Z',
        refreshExpiresAt: '2026-12-14T09:00:00.000Z',
        lastActivityAt: '2026-11-14T09:00:00.123Z',
        createdAt: '2026-11-01T01:00:00.000Z',
        current: true,
      },
    ])
  })

  it('leaves out the hashes of both tokens', () => {
    const presented = JSON.stringify(
      dataOf(SessionReadMapper.toApiSessions([storedSession()], CURRENT)),
    )

    expect(presented).not.toContain('"tokenHash"')
    expect(presented).not.toContain('"refreshTokenHash"')
    expect(presented).not.toContain('ACCESS-TOKEN-HASH')
    expect(presented).not.toContain('REFRESH-TOKEN-HASH')
  })

  it('marks only the session of the request as current and keeps the order', () => {
    const sessions = [
      storedSession({ id: OTHER_SESSION_ID }),
      storedSession(),
      storedSession({ id: THIRD_SESSION_ID }),
    ]

    const result = SessionReadMapper.toApiSessions(sessions, CURRENT)

    expect(dataOf(result).map(({ id, current }) => ({ id, current }))).toEqual([
      { id: OTHER_SESSION_ID, current: false },
      { id: SESSION_ID, current: true },
      { id: THIRD_SESSION_ID, current: false },
    ])
  })

  it('marks no session as current when the session of the request is not among them', () => {
    const sessions = [
      storedSession({ id: OTHER_SESSION_ID }),
      storedSession({ id: THIRD_SESSION_ID }),
    ]

    const result = SessionReadMapper.toApiSessions(sessions, CURRENT)

    expect(dataOf(result).map(({ current }) => current)).toEqual([false, false])
  })

  it('keeps null as null', () => {
    const result = SessionReadMapper.toApiSessions(
      [storedSession({ ipAddress: null, userAgent: null })],
      CURRENT,
    )

    expect(dataOf(result)).toMatchObject([{ ipAddress: null, userAgent: null }])
  })

  it('presents no sessions as an empty list', () => {
    expect(SessionReadMapper.toApiSessions([], CURRENT)).toEqual({
      type: 'success',
      data: [],
    })
  })

  it.each<[string, Partial<DbSession>]>([
    ['expiresAt', { expiresAt: 'soon' }],
    ['refreshExpiresAt', { refreshExpiresAt: 'in eight hours' }],
    ['lastActivityAt', { lastActivityAt: '' }],
    ['createdAt', { createdAt: '2026-13-45 99:00:00+00' }],
  ])(
    'reports a stored session whose %s cannot be read as a database error',
    (_case, overrides) => {
      const result = SessionReadMapper.toApiSessions(
        [storedSession(overrides)],
        CURRENT,
      )

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'database' },
      })
    },
  )

  it('reports the whole list as a database error when one of its sessions cannot be presented', () => {
    const sessions = [
      storedSession({ id: OTHER_SESSION_ID }),
      storedSession({ id: THIRD_SESSION_ID, createdAt: 'yesterday' }),
      storedSession(),
    ]

    const result = SessionReadMapper.toApiSessions(sessions, CURRENT)

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})
