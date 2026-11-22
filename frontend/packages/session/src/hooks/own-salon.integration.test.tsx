import { asked } from '@beauty-salon-frontend/testing/answers'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { queryClientOfATest } from '@beauty-salon-frontend/testing/screens'
import {
  CUSTOMER,
  MANAGER,
  OPERATOR,
  OWNER,
  STYLIST,
} from '@beauty-salon-frontend/testing/seed'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { signIn } from '../api/sign-in'
import { useOwnSalon } from './own-salon'

/** The operation that reads the salon of a member of the staff */
const OWN_PROFILE = '/staff-profiles/me'

const signInAs = (email: string) =>
  signIn({
    email,
    password: testApi().seedPassword,
    rememberMe: false,
    twoFactorCode: null,
  })

const renderOwnSalon = () => {
  const queryClient = queryClientOfATest()

  return renderHook(useOwnSalon, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

/** What the hook gives for a member of the staff, as the database has their salon. */
const memberOfTheDatabase = async (email: string): Promise<unknown> =>
  testApi().query(
    `select 'member' as type, s."salonId"::text as "salonId"
       from staff s join users u on u.id = s."userId"
      where u.email = $1`,
    [email],
  )

describe('the salon of who is signed in, against the API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each<[string, string]>([
    ['the owner of a salon', OWNER],
    ['a manager', MANAGER],
    ['a member of the staff', STYLIST],
  ])(
    'should ask the API for the salon of %s, and give the salon they work at',
    async (_case, email) => {
      // Arrange
      await signInAs(email)
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      const { result } = renderOwnSalon()

      // Assert
      await waitFor(() =>
        expect(result.current.salon).toMatchObject({ type: 'member' }),
      )
      expect([result.current.salon]).toEqual(await memberOfTheDatabase(email))
      expect(asked(fetched)).toContain(`GET ${OWN_PROFILE}`)
    },
  )

  it.each<[string, string, string]>([
    ['the operator of the platform', OPERATOR, 'platform'],
    ['a customer', CUSTOMER, 'none'],
  ])(
    'should know without asking the API that the salon of %s is %s (%s)',
    async (_case, email, type) => {
      // Arrange
      await signInAs(email)
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      const { result } = renderOwnSalon()

      // Assert
      await waitFor(() => expect(result.current.salon).toEqual({ type }))
      expect(asked(fetched)).toEqual(['GET /auth/me'])
    },
  )

  it('should have no salon to give, and ask for none, while nobody is signed in', async () => {
    // Arrange
    const fetched = vi.spyOn(globalThis, 'fetch')

    // Act
    const { result } = renderOwnSalon()

    // Assert
    expect(result.current.salon).toBeUndefined()
    expect(fetched).not.toHaveBeenCalled()
  })
})
