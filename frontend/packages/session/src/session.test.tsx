import {
  getAuthCrudGetCurrentUserQueryKey,
  type ModelsUserResponse,
} from '@beauty-salon-frontend/api-client'
import { type StoredSession, sessionStore } from '@beauty-salon-frontend/io'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  keepQueriesOfOneUser,
  type Session,
  signIn,
  signOut,
  useSession,
} from '.'

const API_ORIGIN = 'http://localhost:3000'
const ME = '/api/v1/auth/me'
const LOGIN = '/api/v1/auth/login'
const LOGOUT = '/api/v1/auth/logout'
const RENEWAL = '/api/v1/auth/refresh'
const STORAGE_KEY = 'beauty-salon:session'

const userOf = (id: string, email: string): ModelsUserResponse => ({
  id,
  email,
  role: 'customer',
  status: 'active',
  emailVerified: true,
  lastPasswordChange: null,
  twoFactorStatus: 'disabled',
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: '2026-11-19T01:00:00.000Z',
  lastLoginIp: null,
  customerId: null,
  staffId: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-19T01:00:00.000Z',
})

const HANAKO = userOf(
  '0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f07',
  'hanako@example.com',
)
const ICHIRO = userOf(
  '0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f08',
  'ichiro@example.com',
)

const sessionOf = (user: ModelsUserResponse, issue: number): StoredSession => ({
  accessToken: `access-${user.email}-${issue}`,
  refreshToken: `refresh-${user.email}-${issue}`,
  userId: user.id,
})

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

const problem = (
  status: number,
  code: string,
  errors: { field: string }[] | null = null,
): Response =>
  new Response(
    JSON.stringify({
      type: 'urn:beauty-salon:problem',
      title: 'Problem',
      status,
      code,
      errors,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
    },
  )

const document = (data: unknown): Response =>
  json(200, { data, meta: null, links: null })

/** The answer of the API to a sign-in or to a refresh token it takes. */
const issued = (user: ModelsUserResponse, issue: number): Response =>
  document({
    ...sessionOf(user, issue),
    token: 'Bearer',
    expiresIn: 900,
    user,
  })

/**
 * An API with two users. The first issue of a user's tokens is good unless
 * `expired` or `ended` names it; a refresh token gets the second issue.
 */
const stubApi = ({
  expired = [],
  ended = [],
  answer,
}: {
  expired?: StoredSession[]
  ended?: StoredSession[]
  answer?: (request: Sent) => Response | Promise<Response> | undefined
} = {}): Sent[] => {
  const sent: Sent[] = []
  const users = [HANAKO, ICHIRO]
  const tokenIn = (sessions: StoredSession[], authorization: string | null) =>
    sessions.some(
      (session) => authorization === `Bearer ${session.accessToken}`,
    )

  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const request: Sent = {
        path: String(input).replace(API_ORIGIN, ''),
        method: init?.method,
        authorization: new Headers(init?.headers).get('Authorization'),
        body: typeof init?.body === 'string' ? init.body : null,
      }
      sent.push(request)

      const special = await answer?.(request)
      if (special !== undefined) {
        return special
      }
      if (request.path === RENEWAL) {
        const owner = users.find((user) =>
          request.body?.includes(sessionOf(user, 1).refreshToken),
        )
        return owner === undefined ? problem(401, '1004') : issued(owner, 2)
      }
      if (tokenIn(expired, request.authorization)) {
        return problem(401, '1003')
      }
      if (tokenIn(ended, request.authorization)) {
        return problem(401, '1004')
      }
      const user = users.find((candidate) =>
        [1, 2].some(
          (issue) =>
            request.authorization ===
            `Bearer ${sessionOf(candidate, issue).accessToken}`,
        ),
      )
      if (user === undefined) {
        return problem(401, request.authorization === null ? '1001' : '1004')
      }

      return request.path === LOGOUT
        ? new Response(null, { status: 204 })
        : document(user)
    }),
  )

  return sent
}

const newQueryClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })

/** Renders the hook and keeps every state it returned, in order. */
const renderSession = (queryClient = newQueryClient()) => {
  const states: Session[] = []
  const rendered = renderHook(
    () => {
      const session = useSession()
      states.push(session)
      return session
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    },
  )

  return { ...rendered, states, queryClient }
}

const signedIn = (user: ModelsUserResponse) => ({ type: 'signedIn', user })

describe('the session of an application', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  describe('useSession', () => {
    it('should say that nobody is signed in, without asking the API, while no session is stored', async () => {
      // Arrange
      const sent = stubApi()

      // Act
      const { result } = renderSession()

      // Assert
      expect(result.current).toEqual({ type: 'signedOut' })
      expect(sent).toEqual([])
    })

    it('should ask the API who is signed in, with the access token of the stored session', async () => {
      // Arrange
      const sent = stubApi()
      sessionStore.write(sessionOf(HANAKO, 1))

      // Act
      const { result, states } = renderSession()

      // Assert
      expect(states[0]).toEqual({ type: 'loading' })
      await waitFor(() => expect(result.current).toEqual(signedIn(HANAKO)))
      expect(sent).toEqual([
        {
          path: ME,
          method: 'GET',
          authorization: `Bearer ${sessionOf(HANAKO, 1).accessToken}`,
          body: null,
        },
      ])
    })

    it('should ask the API once for all the components that use it', async () => {
      // Arrange
      const sent = stubApi()
      sessionStore.write(sessionOf(HANAKO, 1))
      const queryClient = newQueryClient()

      // Act
      const first = renderSession(queryClient)
      const second = renderSession(queryClient)

      // Assert
      await waitFor(() =>
        expect(first.result.current).toEqual(signedIn(HANAKO)),
      )
      await waitFor(() =>
        expect(second.result.current).toEqual(signedIn(HANAKO)),
      )
      expect(sent).toHaveLength(1)
    })

    it('should say that nobody is signed in as soon as the session is removed in this tab', async () => {
      // Arrange
      stubApi()
      sessionStore.write(sessionOf(HANAKO, 1))
      const { result } = renderSession()
      await waitFor(() => expect(result.current.type).toBe('signedIn'))

      // Act
      sessionStore.clear()

      // Assert
      await waitFor(() => expect(result.current).toEqual({ type: 'signedOut' }))
    })

    it('should say that nobody is signed in when another tab has signed out', async () => {
      // Arrange
      stubApi()
      sessionStore.write(sessionOf(HANAKO, 1))
      const { result } = renderSession()
      await waitFor(() => expect(result.current.type).toBe('signedIn'))

      // Act
      localStorage.removeItem(STORAGE_KEY)
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORAGE_KEY, newValue: null }),
      )

      // Assert
      await waitFor(() => expect(result.current).toEqual({ type: 'signedOut' }))
    })

    it('should say that nobody is signed in when the API no longer knows the session', async () => {
      // Arrange
      stubApi({ ended: [sessionOf(HANAKO, 1)] })
      sessionStore.write(sessionOf(HANAKO, 1))

      // Act
      const { result } = renderSession()

      // Assert
      await waitFor(() => expect(result.current).toEqual({ type: 'signedOut' }))
      expect(sessionStore.read()).toBeNull()
    })

    it('should stay signed in over an access token that has expired: the session is renewed', async () => {
      // Arrange
      const sent = stubApi({ expired: [sessionOf(HANAKO, 1)] })
      sessionStore.write(sessionOf(HANAKO, 1))

      // Act
      const { result, states } = renderSession()

      // Assert
      await waitFor(() => expect(result.current).toEqual(signedIn(HANAKO)))
      expect(sent.map((request) => request.path)).toEqual([ME, RENEWAL, ME])
      expect(sessionStore.read()).toEqual(sessionOf(HANAKO, 2))
      expect(states.map((state) => state.type)).not.toContain('signedOut')
    })

    it.each([
      ['an error of the server', () => problem(500, '5001')],
      ['no answer', () => Promise.reject(new TypeError('Failed to fetch'))],
    ])(
      'should say that the session is unavailable after %s, and ask again on retry',
      async (_case, failure) => {
        // Arrange
        const answer =
          vi.fn<() => Response | Promise<Response> | undefined>(failure)
        stubApi({ answer })
        sessionStore.write(sessionOf(HANAKO, 1))
        const { result } = renderSession()
        await waitFor(() => expect(result.current.type).toBe('unavailable'))
        expect(sessionStore.read()).toEqual(sessionOf(HANAKO, 1))

        // Act
        answer.mockImplementation(() => undefined)
        const state = result.current
        if (state.type === 'unavailable') {
          state.retry()
        }

        // Assert
        await waitFor(() => expect(result.current).toEqual(signedIn(HANAKO)))
      },
    )

    it('should show the next user who signs in, and never the one before, without the help of anything else', async () => {
      // Arrange
      stubApi()
      sessionStore.write(sessionOf(HANAKO, 1))
      const { result, states } = renderSession()
      await waitFor(() => expect(result.current).toEqual(signedIn(HANAKO)))
      const before = states.length

      // Act: somebody else signs in, in another tab
      localStorage.setItem(
        STORAGE_KEY,
        new URLSearchParams(sessionOf(ICHIRO, 1)).toString(),
      )
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))

      // Assert
      await waitFor(() => expect(result.current).toEqual(signedIn(ICHIRO)))
      expect(states.slice(before)).not.toContainEqual(signedIn(HANAKO))
    })

    it('should not ask the API again for a component that appears later, however long after', async () => {
      // Arrange
      const sent = stubApi()
      sessionStore.write(sessionOf(HANAKO, 1))
      const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: 0 } },
      })
      const first = renderSession(queryClient)
      await waitFor(() =>
        expect(first.result.current).toEqual(signedIn(HANAKO)),
      )

      // Act
      const later = renderSession(queryClient)

      // Assert
      expect(later.states).toEqual([signedIn(HANAKO)])
      expect(sent).toHaveLength(1)
    })

    it('should keep the user signed in while the user is fetched again, and show what the API then says', async () => {
      // Arrange
      const renamed = { ...HANAKO, email: 'hanako.new@example.com' }
      const answer = vi.fn<() => Promise<Response> | undefined>(() => undefined)
      stubApi({ answer })
      sessionStore.write(sessionOf(HANAKO, 1))
      const { result, states, queryClient } = renderSession()
      await waitFor(() => expect(result.current).toEqual(signedIn(HANAKO)))
      const before = states.length

      // Act: the answer takes long enough for the hook to render meanwhile
      answer.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return document(renamed)
      })
      await queryClient.invalidateQueries({
        queryKey: getAuthCrudGetCurrentUserQueryKey(),
      })

      // Assert
      await waitFor(() => expect(result.current).toEqual(signedIn(renamed)))
      expect(states.length).toBeGreaterThan(before + 1)
      expect(states.slice(before).map((state) => state.type)).not.toContain(
        'loading',
      )
    })
  })

  describe('keepQueriesOfOneUser', () => {
    it('should show the next user who signs in, and nothing that was fetched for the one before', async () => {
      // Arrange
      stubApi()
      sessionStore.write(sessionOf(HANAKO, 1))
      const { result, states, queryClient } = renderSession()
      const stop = keepQueriesOfOneUser(queryClient)
      queryClient.setQueryData(['/api/v1/customers/me'], { firstName: '花子' })
      await waitFor(() => expect(result.current).toEqual(signedIn(HANAKO)))
      const before = states.length

      // Act
      sessionStore.write(sessionOf(ICHIRO, 1))

      // Assert
      await waitFor(() => expect(result.current).toEqual(signedIn(ICHIRO)))
      expect(states.slice(before)).not.toContainEqual(signedIn(HANAKO))
      expect(queryClient.getQueryData(['/api/v1/customers/me'])).toBeUndefined()
      stop()
    })

    it('should remove what was fetched when the user signs out', async () => {
      // Arrange
      stubApi()
      sessionStore.write(sessionOf(HANAKO, 1))
      const queryClient = newQueryClient()
      const stop = keepQueriesOfOneUser(queryClient)
      queryClient.setQueryData(['/api/v1/customers/me'], { firstName: '花子' })

      // Act
      sessionStore.clear()

      // Assert
      expect(queryClient.getQueryData(['/api/v1/customers/me'])).toBeUndefined()
      stop()
    })

    it('should keep what was fetched when the tokens of the same user are renewed', async () => {
      // Arrange
      sessionStore.write(sessionOf(HANAKO, 1))
      const queryClient = newQueryClient()
      const stop = keepQueriesOfOneUser(queryClient)
      queryClient.setQueryData(['/api/v1/customers/me'], { firstName: '花子' })

      // Act
      sessionStore.write(sessionOf(HANAKO, 2))

      // Assert
      expect(queryClient.getQueryData(['/api/v1/customers/me'])).toEqual({
        firstName: '花子',
      })
      stop()
    })

    it('should leave the queries alone after it was stopped', async () => {
      // Arrange
      sessionStore.write(sessionOf(HANAKO, 1))
      const queryClient = newQueryClient()
      const stop = keepQueriesOfOneUser(queryClient)
      queryClient.setQueryData(['/api/v1/customers/me'], { firstName: '花子' })

      // Act
      stop()
      sessionStore.clear()

      // Assert
      expect(queryClient.getQueryData(['/api/v1/customers/me'])).toEqual({
        firstName: '花子',
      })
    })
  })

  describe('signIn', () => {
    const CREDENTIALS = {
      email: 'hanako@example.com',
      password: 'correct horse battery staple',
      rememberMe: false,
      twoFactorCode: null,
    }

    it('should store the session the API issued, so that the user is signed in', async () => {
      // Arrange
      const sent = stubApi({
        answer: (request) =>
          request.path === LOGIN ? issued(HANAKO, 1) : undefined,
      })
      const { result } = renderSession()

      // Act
      const outcome = await signIn(CREDENTIALS)

      // Assert
      expect(outcome).toEqual({ type: 'signedIn' })
      expect(sessionStore.read()).toEqual(sessionOf(HANAKO, 1))
      await waitFor(() => expect(result.current).toEqual(signedIn(HANAKO)))
      expect(sent[0]).toEqual({
        path: LOGIN,
        method: 'POST',
        authorization: null,
        body: JSON.stringify(CREDENTIALS),
      })
    })

    it.each([
      [401, '1002', { type: 'wrongCredentials' }],
      [401, '1007', { type: 'twoFactorCodeRequired' }],
      [401, '1001', { type: 'failed' }],
      [429, '4005', { type: 'tooManyAttempts' }],
      [500, '4001', { type: 'failed' }],
    ])(
      'should store nothing and say what the answer %i with code %s means',
      async (status, code, expected) => {
        // Arrange
        stubApi({
          answer: (request) =>
            request.path === LOGIN ? problem(status, code) : undefined,
        })

        // Act
        const outcome = await signIn(CREDENTIALS)

        // Assert
        expect(outcome).toEqual(expected)
        expect(sessionStore.read()).toBeNull()
      },
    )

    it('should name the properties that the API does not take', async () => {
      // Arrange
      stubApi({
        answer: (request) =>
          request.path === LOGIN
            ? problem(400, '2001', [{ field: 'email' }, { field: 'password' }])
            : undefined,
      })

      // Act
      const outcome = await signIn(CREDENTIALS)

      // Assert
      expect(outcome).toEqual({
        type: 'invalid',
        fields: ['email', 'password'],
      })
    })

    it('should name no property when the API refuses the request without saying which', async () => {
      // Arrange
      stubApi({
        answer: (request) =>
          request.path === LOGIN ? problem(400, '2001') : undefined,
      })

      // Act
      const outcome = await signIn(CREDENTIALS)

      // Assert
      expect(outcome).toEqual({ type: 'invalid', fields: [] })
    })

    it('should say that it failed, and store nothing, when the API cannot be reached', async () => {
      // Arrange
      stubApi({
        answer: () => Promise.reject(new TypeError('Failed to fetch')),
      })

      // Act
      const outcome = await signIn(CREDENTIALS)

      // Assert
      expect(outcome).toEqual({ type: 'failed' })
      expect(sessionStore.read()).toBeNull()
    })

    it('should say that nobody is signed in when the browser stores nothing', async () => {
      // Arrange
      stubApi({
        answer: (request) =>
          request.path === LOGIN ? issued(HANAKO, 1) : undefined,
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException(
          'The quota has been exceeded.',
          'QuotaExceededError',
        )
      })

      // Act
      const outcome = await signIn(CREDENTIALS)

      // Assert
      expect(outcome).toEqual({ type: 'notStored' })
      expect(sessionStore.read()).toBeNull()
    })
  })

  describe('signOut', () => {
    it('should end the session at the API and remove it from the browser', async () => {
      // Arrange
      const sent = stubApi()
      sessionStore.write(sessionOf(HANAKO, 1))
      const { result } = renderSession()
      await waitFor(() => expect(result.current.type).toBe('signedIn'))

      // Act
      await signOut()

      // Assert
      expect(sent.at(-1)).toEqual({
        path: LOGOUT,
        method: 'POST',
        authorization: `Bearer ${sessionOf(HANAKO, 1).accessToken}`,
        body: null,
      })
      expect(sessionStore.read()).toBeNull()
      await waitFor(() => expect(result.current).toEqual({ type: 'signedOut' }))
    })

    it('should end the session at the API also when its access token has expired', async () => {
      // Arrange
      const sent = stubApi({ expired: [sessionOf(HANAKO, 1)] })
      sessionStore.write(sessionOf(HANAKO, 1))

      // Act
      await signOut()

      // Assert
      expect(
        sent.map((request) => [request.path, request.authorization]),
      ).toEqual([
        [LOGOUT, `Bearer ${sessionOf(HANAKO, 1).accessToken}`],
        [RENEWAL, null],
        [LOGOUT, `Bearer ${sessionOf(HANAKO, 2).accessToken}`],
      ])
      expect(sessionStore.read()).toBeNull()
    })

    it.each([
      ['answers with an error', () => problem(500, '5001')],
      [
        'cannot be reached',
        () => Promise.reject(new TypeError('Failed to fetch')),
      ],
    ])(
      'should remove the session from the browser also when the API %s',
      async (_case, failure) => {
        // Arrange
        stubApi({ answer: failure })
        sessionStore.write(sessionOf(HANAKO, 1))

        // Act
        await signOut()

        // Assert
        expect(sessionStore.read()).toBeNull()
      },
    )
  })
})
