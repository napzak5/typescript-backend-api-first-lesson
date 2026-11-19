import { signIn } from '@beauty-salon-frontend/session'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

const TITLE = 'Beauty Salon Portal'
const CUSTOMER = 'customer1@example.com'

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

const header = () => within(screen.getByRole('banner'))

/** Signs in on the screen, as a seeded account. */
const signInAs = async (email: string): Promise<void> => {
  const user = userEvent.setup()
  await user.type(
    await screen.findByRole('textbox', { name: 'メールアドレス' }),
    email,
  )
  await user.type(screen.getByLabelText('パスワード'), testApi().seedPassword)
  await user.click(screen.getByRole('button', { name: 'サインイン' }))
}

const sessionCountOfTheApi = async (): Promise<unknown> =>
  testApi().query('select count(*)::int as count from sessions')

describe('App, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', TITLE)
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
    expect(await heading(TITLE)).toHaveFocus()
    expect(document.title).toBe(TITLE)
    expect(header().getByText(CUSTOMER)).toBeVisible()
    expect(
      header().queryByRole('link', { name: 'サインイン' }),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByRole('status'),
    ).toHaveTextContent('サインインしました。')
  })

  it.each([
    ['a member of the staff', 'stylist1@beautysalon.jp'],
    ['a manager', 'manager@beautysalon.jp'],
    ['the owner of a salon', 'owner@beautysalon.jp'],
    ['the operator of the platform', 'admin@beautysalon.jp'],
  ])('should let %s sign in as well: %s', async (_, email) => {
    // Arrange
    renderAt('/sign-in')

    // Act
    await signInAs(email)

    // Assert
    expect(await heading(TITLE)).toBeVisible()
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
    expect(await heading(TITLE)).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'サインイン' }),
    ).not.toBeInTheDocument()
  })

  it('should sign out from the header and stay on the screen, which is for everybody', async () => {
    // Arrange
    renderAt('/sign-in')
    await signInAs(CUSTOMER)
    await heading(TITLE)

    // Act
    await userEvent.click(
      header().getByRole('button', { name: 'サインアウト' }),
    )

    // Assert
    expect(
      await header().findByRole('link', { name: 'サインイン' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
    expect(screen.queryByText(CUSTOMER)).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByRole('status'),
    ).toHaveTextContent('サインアウトしました。')
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
