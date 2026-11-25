import { sessions } from '@beauty-salon-backend/database'
import {
  type DomainError,
  sessionIdSchema,
  userIdSchema,
  type WrittenMail,
} from '@beauty-salon-backend/domain'
import { SessionRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { eq } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  AUTH,
  insertSession,
  insertUser,
  loginBody,
  minutesFromNow,
  refresh,
  type Session,
  sessionIdOf,
  signedInUser,
  signIn,
  storedSessions,
  type TestUser,
} from '../../../__tests__/_shared/auth-helpers'
import {
  authenticationRequired,
  badRequest,
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  invalidToken,
  notFound,
  request,
  tokenExpired,
} from '../../../__tests__/_shared/test-helpers'

const SESSIONS = `${AUTH}/sessions`
const ME = `${AUTH}/me`

/** A UUID that no session has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** The address of the test client, as IPv4 or IPv4-mapped IPv6. */
const LOOPBACK = /^(::ffff:)?127\.0\.0\.1$|^::1$/

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

/** The properties of a session in a response, and nothing else. */
const SESSION_PROPERTIES = [
  'createdAt',
  'current',
  'expiresAt',
  'id',
  'ipAddress',
  'lastActivityAt',
  'refreshExpiresAt',
  'userAgent',
  'userId',
]

type SignedIn = TestUser & Session

/** A response of the authentication routes, which is never to be stored. */
const expectAuthProblem = (
  response: Response,
  expected: ExpectedProblem,
): void => {
  expectProblem(response, expected)
  expect(response.headers['cache-control']).toBe('no-store')
}

/** 204, no body, nothing to cache. */
const expectNoContent = (response: Response): void => {
  expect(response.status).toBe(204)
  expect(response.text).toBe('')
  expect(response.headers['content-type']).toBeUndefined()
  expect(response.headers['cache-control']).toBe('no-store')
}

const idsOf = (response: Response): string[] =>
  response.body.data.map(({ id }: { id: string }) => id)

describe('Sessions of the signed-in user', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let mails: WrittenMail[]

  beforeEach(() => {
    mails = []
    app = createTestApp({ mails })
    db = getTestDb()
  })

  const get = (authorization: string, path: string) =>
    request(app).get(path).set('Authorization', authorization)
  const list = (authorization: string, query = '') =>
    get(authorization, query === '' ? SESSIONS : `${SESSIONS}?${query}`)
  const revoke = (authorization: string, id: string) =>
    request(app).delete(`${SESSIONS}/${id}`).set('Authorization', authorization)
  const me = (authorization: string) => get(authorization, ME)

  const storedIds = async (): Promise<string[]> =>
    (await storedSessions(db)).map(({ id }) => id).sort()

  /**
   * Who is refused before anything else is looked at: no token, a token that
   * names no session, an access token that has run out.
   */
  const unauthenticated: [
    string,
    (signedIn: SignedIn) => Promise<string | null>,
    ExpectedProblem,
    string,
  ][] = [
    ['no access token', async () => null, authenticationRequired, CHALLENGE],
    [
      'a token that names no session',
      async () => `Bearer ${'t'.repeat(43)}`,
      invalidToken,
      INVALID_TOKEN_CHALLENGE,
    ],
    [
      'a refresh token',
      async ({ refreshToken }) => `Bearer ${refreshToken}`,
      invalidToken,
      INVALID_TOKEN_CHALLENGE,
    ],
    [
      'an access token that has run out',
      async ({ accessToken, authorization }) => {
        await db
          .update(sessions)
          .set({ expiresAt: minutesFromNow(-1) })
          .where(eq(sessions.id, await sessionIdOf(db, accessToken)))
        return authorization
      },
      tokenExpired,
      INVALID_TOKEN_CHALLENGE,
    ],
  ]

  describe('GET /api/v1/auth/sessions', () => {
    it('lists the session of the request as the current one, with its public columns only, not to be cached', async () => {
      const user = await insertUser(db)
      const login = await request(app)
        .post(`${AUTH}/login`)
        .set('User-Agent', 'SalonTest/1.0')
        .send(loginBody(user.email))
      const { accessToken, refreshToken } = login.body.data
      const authorization = `Bearer ${accessToken}`

      const response = await list(authorization)

      expect(response.status).toBe(200)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      expect(response.body).toEqual({
        data: [
          {
            id: await sessionIdOf(db, accessToken),
            userId: user.id,
            ipAddress: expect.stringMatching(LOOPBACK),
            userAgent: 'SalonTest/1.0',
            expiresAt: expect.stringMatching(ISO_TIMESTAMP),
            refreshExpiresAt: expect.stringMatching(ISO_TIMESTAMP),
            lastActivityAt: expect.stringMatching(ISO_TIMESTAMP),
            createdAt: expect.stringMatching(ISO_TIMESTAMP),
            current: true,
          },
        ],
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: SESSIONS,
          first: SESSIONS,
          last: null,
          next: null,
          prev: null,
        },
      })
      const [stored] = await storedSessions(db)
      const shown = JSON.stringify(response.body)
      for (const secret of [
        accessToken,
        refreshToken,
        stored?.tokenHash ?? 'missing hash',
        stored?.refreshTokenHash ?? 'missing hash',
        '"tokenHash"',
        '"refreshTokenHash"',
      ]) {
        expect(shown).not.toContain(secret)
      }
    })

    it('lists every session of the user that has not ended, newest first, also one whose access token has run out, and marks only the session of the request', async () => {
      const user = await signedInUser(app, db)
      const accessRunOut = {
        expiresAt: minutesFromNow(-5),
        refreshExpiresAt: minutesFromNow(60),
        lastActivityAt: minutesFromNow(-20),
        createdAt: minutesFromNow(-30),
      }
      const older = {
        expiresAt: minutesFromNow(10),
        refreshExpiresAt: minutesFromNow(30 * 24 * 60),
        lastActivityAt: minutesFromNow(-5),
        createdAt: minutesFromNow(-3 * 24 * 60),
      }
      const runOut = await insertSession(db, user.id, accessRunOut)
      const remembered = await insertSession(db, user.id, {
        ...older,
        ipAddress: null,
        userAgent: null,
      })
      await insertSession(db, user.id, {
        expiresAt: minutesFromNow(-20),
        refreshExpiresAt: minutesFromNow(-1),
        createdAt: minutesFromNow(-10),
      })
      const someoneElse = await signedInUser(app, db)
      await insertSession(db, someoneElse.id, { createdAt: minutesFromNow(-1) })

      const response = await list(user.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([
        expect.objectContaining({
          id: await sessionIdOf(db, user.accessToken),
          current: true,
        }),
        {
          id: runOut.id,
          userId: user.id,
          ipAddress: '203.0.113.7',
          userAgent: 'SalonTest/1.0',
          ...accessRunOut,
          current: false,
        },
        {
          id: remembered.id,
          userId: user.id,
          ipAddress: null,
          userAgent: null,
          ...older,
          current: false,
        },
      ])
      for (const session of response.body.data) {
        expect(Object.keys(session).sort()).toEqual(SESSION_PROPERTIES)
      }
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
    })

    it('marks the session of the request as current whichever of the sessions of the user asks', async () => {
      const user = await signedInUser(app, db)
      const other = await insertSession(db, user.id)

      const response = await list(other.authorization)

      expect(
        response.body.data.map(
          ({ id, current }: { id: string; current: boolean }) => ({
            id,
            current,
          }),
        ),
      ).toEqual([
        { id: await sessionIdOf(db, user.accessToken), current: false },
        { id: other.id, current: true },
      ])
    })

    it('orders sessions that started at the same moment by their IDs, descending', async () => {
      const user = await signedInUser(app, db)
      const createdAt = minutesFromNow(-30)
      const sameMoment = [
        await insertSession(db, user.id, { createdAt }),
        await insertSession(db, user.id, { createdAt }),
        await insertSession(db, user.id, { createdAt }),
      ]

      const response = await list(user.authorization)

      expect(idsOf(response).slice(1)).toEqual(
        sameMoment
          .map(({ id }) => id)
          .sort((left, right) => (left < right ? 1 : -1)),
      )
    })

    it('walks through the pages with the cursor of the page before, keeping the limit of the request', async () => {
      const user = await signedInUser(app, db)
      const ids = [await sessionIdOf(db, user.accessToken)]
      for (const minutes of [-10, -20, -30, -40]) {
        ids.push(
          (
            await insertSession(db, user.id, {
              createdAt: minutesFromNow(minutes),
            })
          ).id,
        )
      }

      const first = await list(user.authorization, 'limit=2')
      const second = await get(user.authorization, first.body.links.next)
      const third = await get(user.authorization, second.body.links.next)

      expect(idsOf(first)).toEqual(ids.slice(0, 2))
      expect(first.body.meta).toEqual({
        total: 5,
        limit: 2,
        hasMore: true,
        cursor: null,
        nextCursor: ids[1],
        prevCursor: null,
      })
      expect(first.body.links).toEqual({
        self: `${SESSIONS}?limit=2`,
        first: `${SESSIONS}?limit=2`,
        last: null,
        next: `${SESSIONS}?limit=2&cursor=${ids[1]}`,
        prev: null,
      })
      expect(idsOf(second)).toEqual(ids.slice(2, 4))
      expect(second.body.meta).toEqual({
        total: 5,
        limit: 2,
        hasMore: true,
        cursor: ids[1],
        nextCursor: ids[3],
        prevCursor: null,
      })
      expect(second.body.links).toEqual({
        self: `${SESSIONS}?limit=2&cursor=${ids[1]}`,
        first: `${SESSIONS}?limit=2`,
        last: null,
        next: `${SESSIONS}?limit=2&cursor=${ids[3]}`,
        prev: null,
      })
      expect(idsOf(third)).toEqual(ids.slice(4))
      expect(third.body.meta).toEqual({
        total: 5,
        limit: 2,
        hasMore: false,
        cursor: ids[3],
        nextCursor: null,
        prevCursor: null,
      })
      expect(third.body.links).toEqual({
        self: `${SESSIONS}?limit=2&cursor=${ids[3]}`,
        first: `${SESSIONS}?limit=2`,
        last: null,
        next: null,
        prev: null,
      })
    })

    it('says that no page follows a last page that is exactly full', async () => {
      const user = await signedInUser(app, db)
      const older = await insertSession(db, user.id)

      const response = await list(user.authorization, 'limit=2')

      expect(idsOf(response)).toEqual([
        await sessionIdOf(db, user.accessToken),
        older.id,
      ])
      expect(response.body.meta).toMatchObject({
        total: 2,
        hasMore: false,
        nextCursor: null,
      })
      expect(response.body.links.next).toBeNull()
    })

    it('gives pages of 20 sessions unless another limit is asked for, and up to 100', async () => {
      const user = await signedInUser(app, db)
      for (let minutes = 1; minutes <= 20; minutes += 1) {
        await insertSession(db, user.id, {
          createdAt: minutesFromNow(-minutes),
        })
      }

      const byDefault = await list(user.authorization)
      const largest = await list(user.authorization, 'limit=100')

      expect(byDefault.body.data).toHaveLength(20)
      expect(byDefault.body.meta).toMatchObject({
        total: 21,
        limit: 20,
        hasMore: true,
      })
      expect(largest.body.data).toHaveLength(21)
      expect(largest.body.meta).toMatchObject({
        total: 21,
        limit: 100,
        hasMore: false,
      })
    })

    it('starts the page after a cursor written in upper case, and reports the cursor in lower case', async () => {
      const user = await signedInUser(app, db)
      const ownId = await sessionIdOf(db, user.accessToken)
      const older = await insertSession(db, user.id, {
        createdAt: minutesFromNow(-10),
      })

      const response = await list(
        user.authorization,
        `cursor=${ownId.toUpperCase()}`,
      )

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual([older.id])
      expect(response.body.meta).toMatchObject({ total: 2, cursor: ownId })
    })

    it('starts the page after a cursor that names an ended session of the user that is still stored', async () => {
      const user = await signedInUser(app, db)
      await insertSession(db, user.id, { createdAt: minutesFromNow(-10) })
      const ended = await insertSession(db, user.id, {
        createdAt: minutesFromNow(-20),
        expiresAt: minutesFromNow(-30),
        refreshExpiresAt: minutesFromNow(-1),
      })
      const older = await insertSession(db, user.id, {
        createdAt: minutesFromNow(-30),
      })

      const response = await list(user.authorization, `cursor=${ended.id}`)

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual([older.id])
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: ended.id,
        nextCursor: null,
        prevCursor: null,
      })
    })

    it.each<[string, (user: SignedIn) => Promise<string>]>([
      ['a session that never existed', async () => UNKNOWN_ID],
      [
        'a session of another user',
        async () => (await insertSession(db, (await insertUser(db)).id)).id,
      ],
      [
        'a session of the user that was removed since',
        async (user) => {
          const removed = await insertSession(db, user.id)
          await revoke(user.authorization, removed.id)
          return removed.id
        },
      ],
    ])(
      'refuses a cursor that names %s as a broken rule of the cursor',
      async (_case, cursorOf) => {
        const user = await signedInUser(app, db)
        await insertSession(db, user.id)
        const cursor = await cursorOf(user)

        const response = await list(user.authorization, `cursor=${cursor}`)

        expectAuthProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['cursor:not_found'])
      },
    )

    it.each([
      ['a limit that is not a number', 'limit=ten', ['limit:invalid_format']],
      ['an empty limit', 'limit=', ['limit:invalid_format']],
      ['a limit of 0', 'limit=0', ['limit:too_small']],
      ['a limit of 101', 'limit=101', ['limit:too_big']],
      [
        'a limit that is not a whole number',
        'limit=1.5',
        ['limit:invalid_type'],
      ],
      ['a limit given twice', 'limit=1&limit=2', ['limit:invalid_type']],
      ['a cursor that is not a UUID', 'cursor=abc', ['cursor:invalid_format']],
      ['a parameter that does not exist', 'page=2', ['page:unrecognized_keys']],
    ])('rejects %s', async (_case, query, expected) => {
      const user = await signedInUser(app, db)

      const response = await list(user.authorization, query)

      expectAuthProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
    })

    it.each(unauthenticated)(
      'answers %s with 401 before looking at the query',
      async (_case, arrange, problem, challenge) => {
        const user = await signedInUser(app, db)
        const authorization = await arrange(user)

        const call = request(app).get(`${SESSIONS}?limit=0`)
        const response = await (authorization === null
          ? call
          : call.set('Authorization', authorization))

        expectAuthProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )
  })

  describe('DELETE /api/v1/auth/sessions/:sessionId', () => {
    it('ends the named session: its access and refresh tokens stop working at once, and the other sessions keep working', async () => {
      const user = await insertUser(db)
      const asking = await signIn(app, user.email)
      const named = await signIn(app, user.email)
      const third = await signIn(app, user.email)
      const namedId = await sessionIdOf(db, named.accessToken)
      const before = await storedIds()

      const response = await revoke(asking.authorization, namedId)

      expectNoContent(response)
      expect(await storedIds()).toEqual(before.filter((id) => id !== namedId))
      expectAuthProblem(await me(named.authorization), invalidToken)
      expect((await refresh(app, named.refreshToken)).status).toBe(401)
      expect((await me(asking.authorization)).status).toBe(200)
      expect((await me(third.authorization)).status).toBe(200)
      expect((await refresh(app, third.refreshToken)).status).toBe(200)
      expect(mails).toEqual([])
    })

    it('ends the session whose ID the path writes in upper case', async () => {
      const user = await signedInUser(app, db)
      const other = await insertSession(db, user.id)
      const ownId = await sessionIdOf(db, user.accessToken)

      const response = await revoke(user.authorization, other.id.toUpperCase())

      expectNoContent(response)
      expect(await storedIds()).toEqual([ownId])
      expectAuthProblem(await me(other.authorization), invalidToken)
    })

    it('ends the session of the request itself, whose tokens are then refused as after a logout', async () => {
      const user = await signedInUser(app, db)
      const other = await insertSession(db, user.id)

      const response = await revoke(
        user.authorization,
        await sessionIdOf(db, user.accessToken),
      )

      expectNoContent(response)
      expect(await storedIds()).toEqual([other.id])
      expectAuthProblem(await me(user.authorization), invalidToken)
      expect((await refresh(app, user.refreshToken)).status).toBe(401)
      expect((await me(other.authorization)).status).toBe(200)
    })

    it('ends a session whose access token has run out but which has not ended', async () => {
      const user = await signedInUser(app, db)
      const runOut = await insertSession(db, user.id, {
        expiresAt: minutesFromNow(-5),
        refreshExpiresAt: minutesFromNow(60),
      })

      const response = await revoke(user.authorization, runOut.id)

      expectNoContent(response)
      expect(await storedIds()).not.toContain(runOut.id)
      expect((await refresh(app, runOut.refreshToken)).status).toBe(401)
    })

    it.each<[string, (user: SignedIn) => Promise<string>]>([
      ['a session that does not exist', async () => UNKNOWN_ID],
      [
        'a session of the user that has ended',
        async ({ id }) =>
          (
            await insertSession(db, id, {
              expiresAt: minutesFromNow(-10),
              refreshExpiresAt: minutesFromNow(-1),
            })
          ).id,
      ],
      [
        'a session that the user ended a moment ago',
        async ({ id, authorization }) => {
          const ended = await insertSession(db, id)
          await revoke(authorization, ended.id)
          return ended.id
        },
      ],
    ])(
      'answers %s with 404 and removes nothing',
      async (_case, sessionIdFor) => {
        const user = await signedInUser(app, db)
        const sessionId = await sessionIdFor(user)
        const before = await storedIds()

        const response = await revoke(user.authorization, sessionId)

        expectAuthProblem(response, notFound)
        expect(await storedIds()).toEqual(before)
      },
    )

    it('answers a session of another user with 404 and leaves it working', async () => {
      const user = await signedInUser(app, db)
      const someoneElse = await signedInUser(app, db)
      const sessionOfSomeoneElse = await sessionIdOf(
        db,
        someoneElse.accessToken,
      )
      const before = await storedIds()

      const response = await revoke(user.authorization, sessionOfSomeoneElse)

      expectAuthProblem(response, notFound)
      expect(await storedIds()).toEqual(before)
      expect((await me(someoneElse.authorization)).status).toBe(200)
      expect((await refresh(app, someoneElse.refreshToken)).status).toBe(200)
    })

    it('answers a second DELETE of the same session with 404', async () => {
      const user = await signedInUser(app, db)
      const named = await insertSession(db, user.id)

      const first = await revoke(user.authorization, named.id)
      const second = await revoke(user.authorization, named.id)

      expectNoContent(first)
      expectAuthProblem(second, notFound)
    })

    it.each([
      ['a word', 'current'],
      ['a number', '42'],
      ['a UUID with a character too many', `${UNKNOWN_ID}0`],
      ['a UUID without its hyphens', UNKNOWN_ID.replaceAll('-', '')],
    ])(
      'rejects %s as the session ID and removes nothing',
      async (_case, sessionId) => {
        const user = await signedInUser(app, db)
        const before = await storedIds()

        const response = await revoke(user.authorization, sessionId)

        expectAuthProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['sessionId:invalid_format'])
        expect(await storedIds()).toEqual(before)
      },
    )

    it.each(unauthenticated)(
      'answers %s with 401 before looking at the session ID, and removes nothing',
      async (_case, arrange, problem, challenge) => {
        const user = await signedInUser(app, db)
        const other = await insertSession(db, user.id)
        const authorization = await arrange(user)
        const before = await storedIds()

        const calls = [other.id, 'current'].map((sessionId) => {
          const call = request(app).delete(`${SESSIONS}/${sessionId}`)
          return authorization === null
            ? call
            : call.set('Authorization', authorization)
        })
        const responses = await Promise.all(calls)

        for (const response of responses) {
          expectAuthProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await storedIds()).toEqual(before)
      },
    )

    it('lets one of two DELETEs of the same session at the same moment succeed and answers the other with 404', async () => {
      const user = await signedInUser(app, db)
      const named = await insertSession(db, user.id)

      const responses = await Promise.all([
        revoke(user.authorization, named.id),
        revoke(user.authorization, named.id),
      ])

      expect(responses.map(({ status }) => status).sort()).toEqual([204, 404])
      expect(await storedIds()).toEqual([
        await sessionIdOf(db, user.accessToken),
      ])
    })
  })

  describe('SessionRepository', () => {
    /** The moment the repository is told it is: any instant will do. */
    const NOW = '2026-11-14T09:00:00.000Z'
    const AFTER_NOW = '2026-11-14T09:00:00.001Z'

    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    /** A user with a session that ends exactly at `NOW` and one that ends a millisecond later. */
    const userWithSessionsAroundNow = async () => {
      const user = await insertUser(db)
      const endsNow = await insertSession(db, user.id, {
        expiresAt: '2026-11-14T08:50:00.000Z',
        refreshExpiresAt: NOW,
        createdAt: '2026-11-14T08:00:00.000Z',
      })
      const endsLater = await insertSession(db, user.id, {
        expiresAt: '2026-11-14T08:50:00.000Z',
        refreshExpiresAt: AFTER_NOW,
        createdAt: '2026-11-14T07:00:00.000Z',
      })
      return { userId: userIdSchema.parse(user.id), endsNow, endsLater }
    }

    it('listOfUser leaves out a session that ends at the moment it is given and lists one that ends a millisecond later', async () => {
      const { userId, endsLater } = await userWithSessionsAroundNow()

      const result = await new SessionRepository(db).listOfUser({
        userId,
        now: NOW,
        limit: 10,
        after: null,
      })

      expect(dataOf(result)).toMatchObject({
        sessions: [{ id: endsLater.id }],
        total: 1,
        hasMore: false,
      })
    })

    it('listOfUser starts after a cursor that names a session of the user that has ended', async () => {
      const { userId, endsNow, endsLater } = await userWithSessionsAroundNow()

      const result = await new SessionRepository(db).listOfUser({
        userId,
        now: NOW,
        limit: 10,
        after: sessionIdSchema.parse(endsNow.id),
      })

      expect(dataOf(result)).toMatchObject({
        sessions: [{ id: endsLater.id }],
        total: 1,
      })
    })

    it('listOfUser resolves to null for a cursor that names no session of the user', async () => {
      const { userId } = await userWithSessionsAroundNow()
      const ofSomeoneElse = await insertSession(db, (await insertUser(db)).id)

      const repository = new SessionRepository(db)
      const results = await Promise.all(
        [UNKNOWN_ID, ofSomeoneElse.id].map((cursor) =>
          repository.listOfUser({
            userId,
            now: NOW,
            limit: 10,
            after: sessionIdSchema.parse(cursor),
          }),
        ),
      )

      expect(results.map(dataOf)).toEqual([null, null])
    })

    it('deleteOfUser keeps a session that ends at the moment it is given and removes one that ends a millisecond later', async () => {
      const { userId, endsNow, endsLater } = await userWithSessionsAroundNow()
      const repository = new SessionRepository(db)

      const endingNow = await repository.deleteOfUser(
        sessionIdSchema.parse(endsNow.id),
        userId,
        NOW,
      )
      const endingLater = await repository.deleteOfUser(
        sessionIdSchema.parse(endsLater.id),
        userId,
        NOW,
      )

      expect(dataOf(endingNow)).toBe(false)
      expect(dataOf(endingLater)).toBe(true)
      expect(await storedIds()).toEqual([endsNow.id])
    })

    it('deleteOfUser keeps the session of another user', async () => {
      const { userId } = await userWithSessionsAroundNow()
      const ofSomeoneElse = await insertSession(db, (await insertUser(db)).id, {
        refreshExpiresAt: AFTER_NOW,
      })

      const result = await new SessionRepository(db).deleteOfUser(
        sessionIdSchema.parse(ofSomeoneElse.id),
        userId,
        NOW,
      )

      expect(dataOf(result)).toBe(false)
      expect(await storedIds()).toContain(ofSomeoneElse.id)
    })
  })
})
