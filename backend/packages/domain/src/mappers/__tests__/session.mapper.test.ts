import { describe, expect, it } from 'vitest'
import {
  dataOf,
  dbSession,
  dbUser,
  PASSWORD,
  SESSION_ID,
  USER_ID,
} from '../../__tests__/fixtures/auth-fixtures'
import {
  type DbSession,
  sessionIdSchema,
  userIdSchema,
} from '../../models/auth'
import { sessionSearchRequestSchema } from '../../schemas/auth.schema'
import { SessionReadMapper } from '../read/session.mapper'
import { UserReadMapper } from '../read/user.mapper'
import { SessionWriteMapper } from '../write/session.mapper'

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

describe('SessionReadMapper.toApiSessionPage', () => {
  const paging = { limit: 2, after: sessionIdSchema.parse(THIRD_SESSION_ID) }

  it('answers with the sessions, the counts of the list and the place of the page, and marks the session of the request', () => {
    expect(
      SessionReadMapper.toApiSessionPage(
        {
          sessions: [storedSession(), storedSession({ id: OTHER_SESSION_ID })],
          total: 5,
          hasMore: true,
        },
        paging,
        CURRENT,
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        data: [
          { id: SESSION_ID, current: true },
          { id: OTHER_SESSION_ID, current: false },
        ],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: THIRD_SESSION_ID,
          nextCursor: OTHER_SESSION_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next page when the list ends with this one, an empty one too', () => {
    expect(
      SessionReadMapper.toApiSessionPage(
        { sessions: [storedSession()], total: 1, hasMore: false },
        { limit: 20, after: null },
        CURRENT,
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      },
    })
    expect(
      SessionReadMapper.toApiSessionPage(
        { sessions: [], total: 0, hasMore: false },
        { limit: 20, after: null },
        CURRENT,
      ),
    ).toStrictEqual({
      type: 'success',
      data: {
        data: [],
        meta: {
          total: 0,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('fails when one of the sessions cannot be presented', () => {
    expect(
      SessionReadMapper.toApiSessionPage(
        {
          sessions: [
            storedSession(),
            storedSession({ id: OTHER_SESSION_ID, createdAt: 'yesterday' }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
        CURRENT,
      ),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored session ${OTHER_SESSION_ID} does not match the API model`,
      },
    })
  })
})

describe('SessionReadMapper.toApiLogin', () => {
  const tokens = {
    accessToken: 'ACCESS-TOKEN',
    refreshToken: 'REFRESH-TOKEN',
    expiresIn: 900,
    rotation: {
      tokenHash: 'HASH-OF-THE-ACCESS-TOKEN',
      refreshTokenHash: 'HASH-OF-THE-REFRESH-TOKEN',
      expiresAt: '2026-11-14T09:15:00.000Z',
      lastActivityAt: '2026-11-14T09:00:00.000Z',
    },
  }

  it('answers with the tokens as they were issued, how long the access token works, and the account', () => {
    expect(SessionReadMapper.toApiLogin(tokens, dbUser())).toStrictEqual({
      type: 'success',
      data: {
        accessToken: 'ACCESS-TOKEN',
        refreshToken: 'REFRESH-TOKEN',
        token: 'Bearer',
        expiresIn: 900,
        user: dataOf(UserReadMapper.toApiUser(dbUser())),
      },
    })
  })

  it('leaves out what is stored of the tokens', () => {
    const presented = JSON.stringify(
      dataOf(SessionReadMapper.toApiLogin(tokens, dbUser())),
    )

    expect(presented).not.toContain('rotation')
    expect(presented).not.toContain('HASH-OF-THE-ACCESS-TOKEN')
    expect(presented).not.toContain('HASH-OF-THE-REFRESH-TOKEN')
  })

  it('fails for an account it cannot present', () => {
    expect(
      SessionReadMapper.toApiLogin(tokens, dbUser({ createdAt: 'never' })),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored user ${USER_ID} does not match the API model`,
      },
    })
  })
})

describe('SessionWriteMapper', () => {
  it('takes what a login presents as it is, the code of the second factor too', () => {
    expect(
      SessionWriteMapper.fromLoginRequest({
        email: 'owner@salon.example',
        password: PASSWORD,
        rememberMe: true,
        twoFactorCode: '492039',
      }),
    ).toStrictEqual({
      email: 'owner@salon.example',
      password: PASSWORD,
      rememberMe: true,
      twoFactorCode: '492039',
    })
  })

  it('takes a login without a second factor, for a session that is not to last', () => {
    expect(
      SessionWriteMapper.fromLoginRequest({
        email: 'staff@salon.example',
        password: 'another password of the staff',
        rememberMe: false,
        twoFactorCode: null,
      }),
    ).toStrictEqual({
      email: 'staff@salon.example',
      password: 'another password of the staff',
      rememberMe: false,
      twoFactorCode: null,
    })
  })

  it('takes the refresh token as it is presented', () => {
    expect(
      SessionWriteMapper.fromTokenRefreshRequest({
        refreshToken: 'REFRESH-TOKEN',
      }),
    ).toStrictEqual({ refreshToken: 'REFRESH-TOKEN' })
  })
})

describe('SessionWriteMapper.fromSearchRequest', () => {
  const userId = userIdSchema.parse(USER_ID)

  it('lists the first 20 sessions of the user that have not ended at the moment it is given, when the request names nothing', () => {
    expect(
      SessionWriteMapper.fromSearchRequest(
        sessionSearchRequestSchema.parse({}),
        userId,
        '2026-11-14T09:00:00.000Z',
      ),
    ).toStrictEqual({
      userId: USER_ID,
      now: '2026-11-14T09:00:00.000Z',
      limit: 20,
      after: null,
    })
  })

  it('takes the place of the page the request names', () => {
    expect(
      SessionWriteMapper.fromSearchRequest(
        sessionSearchRequestSchema.parse({ limit: 5, cursor: SESSION_ID }),
        userId,
        '2026-11-15T00:00:00.000Z',
      ),
    ).toStrictEqual({
      userId: USER_ID,
      now: '2026-11-15T00:00:00.000Z',
      limit: 5,
      after: SESSION_ID,
    })
  })
})
