import { applications } from '@beauty-salon-frontend/brand'
import { signIn } from '@beauty-salon-frontend/session'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { signInAs, testApi } from '@beauty-salon-frontend/testing/api'
import { heading, statusMessages } from '@beauty-salon-frontend/testing/screens'
import {
  CUSTOMER,
  MANAGER,
  OPERATOR,
  OWNER,
  STYLIST,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from './__tests__/screens'

const TITLE = applications.portal.name
/** The heading of the first screen of the portal, the search of the salons */
const START = 'サロンを探す'

const header = () => within(screen.getByRole('banner'))

const sessionCountOfTheApi = async (): Promise<unknown> =>
  testApi().query('select count(*)::int as count from sessions')

describe('App, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should lead a customer who signs in to the start, and say in the header who is signed in', async () => {
    // Arrange
    renderAt('/sign-in')

    // Act
    await signInAs(CUSTOMER)

    // Assert
    expect(await heading(START)).toHaveFocus()
    expect(document.title).toBe(`${START} | ${TITLE}`)
    expect(header().getByText(CUSTOMER)).toBeVisible()
    expect(
      header().queryByRole('link', { name: 'サインイン' }),
    ).not.toBeInTheDocument()
    expect(statusMessages()).toContain('サインインしました。')
    // The links of the header are those of a customer, at the start
    expect(
      within(
        await screen.findByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: START }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    ['a member of the staff', STYLIST],
    ['a manager', MANAGER],
    ['the owner of a salon', OWNER],
    ['the operator of the platform', OPERATOR],
  ])('should let %s sign in as well: %s', async (_, email) => {
    // Arrange
    renderAt('/sign-in')

    // Act
    await signInAs(email)

    // Assert
    expect(await heading(START)).toBeVisible()
    expect(header().getByText(email)).toBeVisible()
  })

  it('should lead somebody who is signed in away from the sign-in screen', async () => {
    // Arrange
    await signIn({
      email: CUSTOMER,
      password: testApi().seedPassword,
      rememberMe: false,
      twoFactorCode: null,
    })

    // Act
    renderAt('/sign-in')

    // Assert
    expect(await heading(START)).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'サインイン' }),
    ).not.toBeInTheDocument()
  })

  it('should sign out from the header and stay on the screen, which is for everybody', async () => {
    // Arrange
    renderAt('/sign-in')
    await signInAs(CUSTOMER)
    await heading(START)

    // Act
    await userEvent.click(
      header().getByRole('button', { name: 'サインアウト' }),
    )

    // Assert
    expect(
      await header().findByRole('link', { name: 'サインイン' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: START })).toBeVisible()
    expect(screen.queryByText(CUSTOMER)).not.toBeInTheDocument()
    expect(statusMessages()).toContain('サインアウトしました。')
    expect(await sessionCountOfTheApi()).toEqual([{ count: 0 }])
  })

  it('should have no accessibility violations for a signed-in user', async () => {
    // Arrange
    vi.stubEnv('VITE_MODE', 'staging')
    renderAt('/sign-in')
    await signInAs(CUSTOMER)
    await screen.findByRole('button', { name: 'サインアウト' })

    // Act
    const violations = await findAccessibilityViolations()

    // Assert
    expect(violations).toEqual([])
  })
})
