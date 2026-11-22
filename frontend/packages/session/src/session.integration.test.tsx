import { authCrudGetCurrentUser } from '@beauty-salon-frontend/api-client'
import { sessionStore } from '@beauty-salon-frontend/io'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { queryClientOfATest } from '@beauty-salon-frontend/testing/screens'
import { CUSTOMER } from '@beauty-salon-frontend/testing/seed'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { signIn, signOut, useSession } from '.'

const RENEWAL = '/api/v1/auth/refresh'

const signInAs = (email: string, password = testApi().seedPassword) =>
  signIn({ email, password, rememberMe: false, twoFactorCode: null })

const renderSession = () => {
  const queryClient = queryClientOfATest()

  return renderHook(useSession, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

/** The sessions the API keeps, as its database has them. */
const sessionsOfTheApi = () =>
  testApi().query('select "userId"::text as "userId" from sessions')

/** As when fifteen minutes have passed since the tokens were issued. */
const letTheAccessTokensExpire = () =>
  testApi().query(
    `update sessions set "expiresAt" = now() - interval '1 minute'`,
  )

/** As when the time of the refresh tokens has passed as well. */
const letTheSessionsExpire = () =>
  testApi().query(
    `update sessions set "expiresAt" = now() - interval '2 minutes', "refreshExpiresAt" = now() - interval '1 minute'`,
  )

describe('the session against the API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should sign a user in, keep the session and know who it is', async () => {
    // Act
    const outcome = await signInAs(CUSTOMER)
    const { result } = renderSession()

    // Assert
    expect(outcome).toEqual({ type: 'signedIn' })
    await waitFor(() =>
      expect(result.current).toMatchObject({
        type: 'signedIn',
        user: { email: CUSTOMER, role: 'customer' },
      }),
    )
    const userId = sessionStore.userId()
    expect(userId).not.toBeNull()
    expect(await sessionsOfTheApi()).toEqual([{ userId }])
  })

  it('should stay signed out when the password is wrong', async () => {
    // Act
    const outcome = await signInAs(CUSTOMER, 'not the password')
    const { result } = renderSession()

    // Assert
    expect(outcome).toEqual({ type: 'wrongCredentials' })
    expect(sessionStore.read()).toBeNull()
    expect(result.current).toEqual({ type: 'signedOut' })
    expect(await sessionsOfTheApi()).toEqual([])
  })

  it('should renew an access token that has expired, and answer the request', async () => {
    // Arrange
    await signInAs(CUSTOMER)
    const issued = sessionStore.read()
    await letTheAccessTokensExpire()

    // Act
    const response = await authCrudGetCurrentUser()

    // Assert
    expect(response).toMatchObject({
      status: 200,
      data: { data: { email: CUSTOMER } },
    })
    const renewed = sessionStore.read()
    expect(renewed?.userId).toBe(issued?.userId)
    expect(renewed?.accessToken).not.toBe(issued?.accessToken)
    expect(renewed?.refreshToken).not.toBe(issued?.refreshToken)
    expect(await sessionsOfTheApi()).toHaveLength(1)
  })

  it('should renew once for requests that find the token expired at the same time', async () => {
    // Arrange
    await signInAs(CUSTOMER)
    await letTheAccessTokensExpire()
    const sent = vi.spyOn(globalThis, 'fetch')

    // Act
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => authCrudGetCurrentUser()),
    )

    // Assert
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200, 200,
    ])
    const renewals = sent.mock.calls.filter(([url]) =>
      String(url).endsWith(RENEWAL),
    )
    expect(renewals).toHaveLength(1)
    expect(await sessionsOfTheApi()).toHaveLength(1)
  })

  it('should sign the user out when the session can no longer be renewed', async () => {
    // Arrange
    await signInAs(CUSTOMER)
    const { result } = renderSession()
    await waitFor(() => expect(result.current.type).toBe('signedIn'))
    await letTheSessionsExpire()

    // Act
    const response = await authCrudGetCurrentUser()

    // Assert
    expect(response.status).toBe(401)
    expect(sessionStore.read()).toBeNull()
    await waitFor(() => expect(result.current).toEqual({ type: 'signedOut' }))
  })

  it('should sign the user out when the API has ended the session', async () => {
    // Arrange
    await signInAs(CUSTOMER)
    const { result } = renderSession()
    await waitFor(() => expect(result.current.type).toBe('signedIn'))
    await testApi().query('delete from sessions')

    // Act
    const response = await authCrudGetCurrentUser()

    // Assert
    expect(response).toMatchObject({ status: 401, data: { code: '1004' } })
    expect(sessionStore.read()).toBeNull()
    await waitFor(() => expect(result.current).toEqual({ type: 'signedOut' }))
  })

  it('should end the session at the API and in the browser when signing out', async () => {
    // Arrange
    await signInAs(CUSTOMER)
    const { result } = renderSession()
    await waitFor(() => expect(result.current.type).toBe('signedIn'))

    // Act
    await signOut()

    // Assert
    expect(await sessionsOfTheApi()).toEqual([])
    expect(sessionStore.read()).toBeNull()
    await waitFor(() => expect(result.current).toEqual({ type: 'signedOut' }))
  })
})
