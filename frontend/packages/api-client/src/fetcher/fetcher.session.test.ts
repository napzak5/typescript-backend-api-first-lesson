import type { StoredSession } from '@beauty-salon-frontend/io'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const API_ORIGIN = 'http://localhost:3000'
const RESOURCE = '/api/v1/customers/me'
const RENEWAL = '/api/v1/auth/refresh'
const STORAGE_KEY = 'beauty-salon:session'
const USER_ID = '0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f07'

const FIRST: StoredSession = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  userId: USER_ID,
}

const SECOND: StoredSession = {
  accessToken: 'access-2',
  refreshToken: 'refresh-2',
  userId: USER_ID,
}

type HttpResponse = {
  data: unknown
  status: number
  headers: Headers
}

type Sent = {
  path: string
  method: string | undefined
  authorization: string | null
  body: string | null
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

const problem = (status: number, code: string): Response =>
  new Response(
    JSON.stringify({
      type: 'urn:beauty-salon:problem',
      title: 'Problem',
      status,
      code,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/problem+json; charset=utf-8',
        'WWW-Authenticate': 'Bearer realm="beauty-salon-api"',
      },
    },
  )

/** The answer of the API to a refresh token it takes. */
const issued = (session: StoredSession): Response =>
  json(200, {
    data: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      token: 'Bearer',
      expiresIn: 900,
      user: { id: session.userId, email: 'hanako@example.com' },
    },
    meta: null,
    links: null,
  })

const PROFILE = { data: { id: 'c_1', firstName: '花子' } }

/**
 * An API that knows the two sessions: the access token of the first has
 * expired, that of the second is good, and any other belongs to no session.
 */
const answerOfTheApi = (authorization: string | null): Response => {
  if (authorization === `Bearer ${SECOND.accessToken}`) {
    return json(200, PROFILE)
  }
  if (authorization === `Bearer ${FIRST.accessToken}`) {
    return problem(401, '1003')
  }

  return problem(401, authorization === null ? '1001' : '1004')
}

type Api = {
  answer?: (authorization: string | null) => Response
  renew?: (refreshToken: string) => Response | Promise<Response>
}

const stubApi = ({
  answer = answerOfTheApi,
  renew = () => issued(SECOND),
}: Api = {}): Sent[] => {
  const sent: Sent[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input).replace(API_ORIGIN, '')
      const authorization = new Headers(init?.headers).get('Authorization')
      const body = typeof init?.body === 'string' ? init.body : null
      sent.push({ path, method: init?.method, authorization, body })

      return path === RENEWAL
        ? renew(String(JSON.parse(body ?? '{}').refreshToken))
        : answer(authorization)
    }),
  )

  return sent
}

/** Fresh copies of the fetch function and of the stored session: no renewal under way, no listeners. */
const loadFresh = async () => {
  vi.resetModules()
  const [{ customInstance }, { sessionStore }] = await Promise.all([
    import('./fetcher'),
    import('@beauty-salon-frontend/io'),
  ])

  return { call: customInstance<HttpResponse>, sessionStore }
}

/** As another tab of the application stores a session: this tab is not told. */
const storeInAnotherTab = (session: StoredSession): void => {
  localStorage.setItem(STORAGE_KEY, new URLSearchParams(session).toString())
}

const renewalsOf = (sent: Sent[]): Sent[] =>
  sent.filter((request) => request.path === RENEWAL)

const requestsOf = (sent: Sent[]): Sent[] =>
  sent.filter((request) => request.path === RESOURCE)

describe('customInstance with a session', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_BACKEND_BASE_URL', API_ORIGIN)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    localStorage.clear()
    Reflect.deleteProperty(navigator, 'locks')
  })

  describe('the access token', () => {
    it('should send no Authorization header while nobody is signed in', async () => {
      // Arrange
      const sent = stubApi()
      const { call } = await loadFresh()

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(sent).toEqual([
        { path: RESOURCE, method: 'GET', authorization: null, body: null },
      ])
      expect(response.status).toBe(401)
    })

    it('should send the request without a token in a browser that refuses access to its storage', async () => {
      // Arrange
      const sent = stubApi({ answer: () => json(200, PROFILE) })
      const { call } = await loadFresh()
      vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
        throw new DOMException(
          'Access is denied for this document.',
          'SecurityError',
        )
      })

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(sent).toEqual([
        { path: RESOURCE, method: 'GET', authorization: null, body: null },
      ])
      expect(response.status).toBe(200)
    })

    it('should send the access token of the stored session as a bearer token', async () => {
      // Arrange
      const sent = stubApi()
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(SECOND)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(sent).toEqual([
        {
          path: RESOURCE,
          method: 'GET',
          authorization: 'Bearer access-2',
          body: null,
        },
      ])
      expect(response).toMatchObject({ status: 200, data: PROFILE })
    })

    it('should keep the headers of the caller next to the access token', async () => {
      // Arrange
      const fetchMock = vi.fn<typeof fetch>(async () => json(200, PROFILE))
      vi.stubGlobal('fetch', fetchMock)
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(SECOND)

      // Act
      await call(RESOURCE, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'r_1' },
        body: '{"firstName":"花子"}',
      })

      // Assert
      const [, init] = fetchMock.mock.calls[0] ?? []
      expect([...new Headers(init?.headers)]).toEqual([
        ['authorization', 'Bearer access-2'],
        ['content-type', 'application/json'],
        ['x-request-id', 'r_1'],
      ])
    })
  })

  describe('an access token that has expired', () => {
    it('should renew the session once, store it, and send the request again with the new token', async () => {
      // Arrange
      const sent = stubApi()
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(sent).toEqual([
        {
          path: RESOURCE,
          method: 'GET',
          authorization: 'Bearer access-1',
          body: null,
        },
        {
          path: RENEWAL,
          method: 'POST',
          authorization: null,
          body: '{"refreshToken":"refresh-1"}',
        },
        {
          path: RESOURCE,
          method: 'GET',
          authorization: 'Bearer access-2',
          body: null,
        },
      ])
      expect(response).toMatchObject({ status: 200, data: PROFILE })
      expect(sessionStore.read()).toEqual(SECOND)
    })

    it('should send the body of the request again as it was', async () => {
      // Arrange
      const sent = stubApi()
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      await call(RESOURCE, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{"firstName":"花子"}',
      })

      // Assert
      expect(requestsOf(sent)).toEqual([
        {
          path: RESOURCE,
          method: 'PATCH',
          authorization: 'Bearer access-1',
          body: '{"firstName":"花子"}',
        },
        {
          path: RESOURCE,
          method: 'PATCH',
          authorization: 'Bearer access-2',
          body: '{"firstName":"花子"}',
        },
      ])
    })

    it('should renew the session once for all the requests that find the token expired at the same time', async () => {
      // Arrange
      const sent = stubApi({
        renew: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20))
          return issued(SECOND)
        },
      })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => call(RESOURCE, { method: 'GET' })),
      )

      // Assert
      expect(renewalsOf(sent)).toHaveLength(1)
      expect(requestsOf(sent).map((request) => request.authorization)).toEqual([
        ...Array.from({ length: 5 }, () => 'Bearer access-1'),
        ...Array.from({ length: 5 }, () => 'Bearer access-2'),
      ])
      expect(responses.map((response) => response.status)).toEqual([
        200, 200, 200, 200, 200,
      ])
    })

    it('should renew again when the next token expires in its turn', async () => {
      // Arrange
      const third = {
        accessToken: 'access-3',
        refreshToken: 'refresh-3',
        userId: USER_ID,
      }
      const sent = stubApi({
        answer: (authorization) =>
          authorization === 'Bearer access-3'
            ? json(200, PROFILE)
            : problem(401, '1003'),
        renew: (refreshToken) =>
          issued(refreshToken === 'refresh-1' ? SECOND : third),
      })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const first = await call(RESOURCE, { method: 'GET' })
      const second = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(first.status).toBe(401)
      expect(second.status).toBe(200)
      expect(renewalsOf(sent).map((request) => request.body)).toEqual([
        '{"refreshToken":"refresh-1"}',
        '{"refreshToken":"refresh-2"}',
      ])
      expect(sessionStore.read()).toEqual(third)
    })

    it('should send the request again once only, and return the second answer whatever it is', async () => {
      // Arrange
      const sent = stubApi({ answer: () => problem(401, '1003') })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(requestsOf(sent)).toHaveLength(2)
      expect(renewalsOf(sent)).toHaveLength(1)
      expect(response).toMatchObject({ status: 401, data: { code: '1003' } })
      expect(sessionStore.read()).toEqual(SECOND)
    })

    it('should use the session another tab has stored in the meantime, without renewing', async () => {
      // Arrange
      const sent = stubApi({
        answer: (authorization) => {
          // The other tab renews while the answer is on its way
          storeInAnotherTab(SECOND)
          return answerOfTheApi(authorization)
        },
      })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(renewalsOf(sent)).toEqual([])
      expect(requestsOf(sent).map((request) => request.authorization)).toEqual([
        'Bearer access-1',
        'Bearer access-2',
      ])
      expect(response.status).toBe(200)
    })

    it('should give up, and leave the user signed out, when another tab has signed out in the meantime', async () => {
      // Arrange
      const sent = stubApi({
        answer: (authorization) => {
          localStorage.removeItem(STORAGE_KEY)
          return answerOfTheApi(authorization)
        },
      })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(sent).toHaveLength(1)
      expect(response).toMatchObject({ status: 401, data: { code: '1003' } })
      expect(sessionStore.read()).toBeNull()
    })
  })

  describe('a renewal the API refuses', () => {
    it('should remove the session, tell the listeners, and return the 401 of the request', async () => {
      // Arrange
      const sent = stubApi({ renew: () => problem(401, '1004') })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)
      const listener = vi.fn()
      sessionStore.subscribe(listener)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(response).toMatchObject({ status: 401, data: { code: '1003' } })
      expect(sessionStore.read()).toBeNull()
      expect(listener).toHaveBeenCalledTimes(1)
      expect(requestsOf(sent)).toHaveLength(1)
    })

    it('should go on with the session of the tab that used the refresh token first', async () => {
      // Arrange
      const sent = stubApi({
        renew: () => {
          storeInAnotherTab(SECOND)
          return problem(401, '1004')
        },
      })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(response.status).toBe(200)
      expect(sessionStore.read()).toEqual(SECOND)
      expect(renewalsOf(sent)).toHaveLength(1)
    })
  })

  describe('a renewal that fails', () => {
    it.each([
      ['a server error', () => problem(500, '5001')],
      ['too many requests', () => problem(429, '4004')],
      ['an answer without a session', () => json(200, { data: {} })],
      [
        'an answer with an empty access token',
        () =>
          json(200, {
            data: {
              accessToken: '',
              refreshToken: 'refresh-2',
              user: { id: USER_ID },
            },
          }),
      ],
      [
        'an answer without a refresh token',
        () =>
          json(200, {
            data: { accessToken: 'access-2', user: { id: USER_ID } },
          }),
      ],
      [
        'an answer without a user',
        () =>
          json(200, {
            data: { accessToken: 'access-2', refreshToken: 'refresh-2' },
          }),
      ],
      [
        'a body that is not JSON',
        () => new Response('<html>', { status: 200 }),
      ],
      ['no answer', () => Promise.reject(new TypeError('Failed to fetch'))],
    ])(
      'should keep the session and return the 401 of the request after %s',
      async (_case, renew) => {
        // Arrange
        const sent = stubApi({ renew })
        const { call, sessionStore } = await loadFresh()
        sessionStore.write(FIRST)

        // Act
        const response = await call(RESOURCE, { method: 'GET' })

        // Assert
        expect(response).toMatchObject({ status: 401, data: { code: '1003' } })
        expect(sessionStore.read()).toEqual(FIRST)
        expect(requestsOf(sent)).toHaveLength(1)
      },
    )

    it('should try to renew again with the next request', async () => {
      // Arrange
      const renew = vi
        .fn<() => Response>()
        .mockReturnValueOnce(problem(500, '5001'))
        .mockReturnValue(issued(SECOND))
      stubApi({ renew })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const first = await call(RESOURCE, { method: 'GET' })
      const second = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(first.status).toBe(401)
      expect(second.status).toBe(200)
      expect(renew).toHaveBeenCalledTimes(2)
    })
  })

  describe('an access token that belongs to no session', () => {
    it('should remove the session without trying to renew it', async () => {
      // Arrange
      const sent = stubApi({ answer: () => problem(401, '1004') })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)
      const listener = vi.fn()
      sessionStore.subscribe(listener)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(sent).toHaveLength(1)
      expect(response).toMatchObject({ status: 401, data: { code: '1004' } })
      expect(sessionStore.read()).toBeNull()
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should send the request again when the token was replaced by a renewal while the request was on its way', async () => {
      // Arrange
      const sent = stubApi({
        answer: (authorization) => {
          if (authorization === 'Bearer access-1') {
            // Another request, or another tab, renewed: the old token stopped working
            storeInAnotherTab(SECOND)
            return problem(401, '1004')
          }
          return json(200, PROFILE)
        },
      })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(response.status).toBe(200)
      expect(sent.map((request) => request.authorization)).toEqual([
        'Bearer access-1',
        'Bearer access-2',
      ])
      expect(sessionStore.read()).toEqual(SECOND)
    })
  })

  describe('a 401 that is not about the access token', () => {
    it.each([
      ['1002', 'a failed sign-in'],
      ['1007', 'a missing two-factor code'],
      ['1006', 'a wrong current password'],
    ])(
      'should return code %s (%s) as it is: no renewal, no second request, the session stays',
      async (code) => {
        // Arrange
        const sent = stubApi({ answer: () => problem(401, code) })
        const { call, sessionStore } = await loadFresh()
        sessionStore.write(SECOND)

        // Act
        const response = await call('/api/v1/auth/change-password', {
          method: 'POST',
          body: '{}',
        })

        // Assert
        expect(sent).toHaveLength(1)
        expect(response).toMatchObject({ status: 401, data: { code } })
        expect(sessionStore.read()).toEqual(SECOND)
      },
    )

    it('should return a 401 without a body it understands as it is', async () => {
      // Arrange
      const sent = stubApi({
        answer: () => new Response('Unauthorized', { status: 401 }),
      })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(SECOND)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(sent).toHaveLength(1)
      expect(response).toMatchObject({ status: 401, data: 'Unauthorized' })
      expect(sessionStore.read()).toEqual(SECOND)
    })

    it('should not try to renew for somebody who is not signed in', async () => {
      // Arrange
      const sent = stubApi({ answer: () => problem(401, '1003') })
      const { call } = await loadFresh()

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(sent).toHaveLength(1)
      expect(response.status).toBe(401)
    })
  })

  describe('several tabs, in a browser with Web Locks', () => {
    const stubLocks = (
      request: (name: string, task: () => Promise<unknown>) => Promise<unknown>,
    ) => {
      const locks = { request: vi.fn(request) }
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: locks,
      })

      return locks
    }

    it('should renew while it holds the lock of the application', async () => {
      // Arrange
      const order: string[] = []
      const sent = stubApi({
        renew: () => {
          order.push('renewal')
          return issued(SECOND)
        },
      })
      const locks = stubLocks(async (_name, task) => {
        order.push('lock taken')
        const result = await task()
        order.push('lock released')
        return result
      })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(locks.request).toHaveBeenCalledTimes(1)
      expect(locks.request).toHaveBeenCalledWith(
        'beauty-salon:session-renewal',
        expect.any(Function),
      )
      expect(order).toEqual(['lock taken', 'renewal', 'lock released'])
      expect(response.status).toBe(200)
      expect(renewalsOf(sent)).toHaveLength(1)
    })

    it('should use the session of the tab that held the lock before it, without renewing', async () => {
      // Arrange
      const sent = stubApi()
      stubLocks(async (_name, task) => {
        // While this tab waited for the lock, the tab that held it renewed
        storeInAnotherTab(SECOND)
        return task()
      })
      const { call, sessionStore } = await loadFresh()
      sessionStore.write(FIRST)

      // Act
      const response = await call(RESOURCE, { method: 'GET' })

      // Assert
      expect(renewalsOf(sent)).toEqual([])
      expect(response.status).toBe(200)
      expect(requestsOf(sent).map((request) => request.authorization)).toEqual([
        'Bearer access-1',
        'Bearer access-2',
      ])
    })
  })
})
