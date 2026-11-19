import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

/** The screens of a customer: where a service is booked, and a booking */
const BOOKING_PATH =
  '/salons/0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90/services/1a3c5e7f-9b20-4d46-8e68-0a2c4e6f8b79/booking'
const OWN_BOOKING_PATH = '/bookings/e7092b3c-68fd-4a13-9b35-d7f902245846'

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )

/**
 * Nobody is signed in: what the application shows without asking the API.
 * The root path is not among it: it searches for salons, and is tested with
 * the screens of the salons, against the API.
 */
describe('App', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', 'Beauty Salon Portal')
    vi.stubEnv('VITE_MODE', 'production')
    vi.stubEnv('VITE_ADMIN_APP_URL', 'https://admin.salon.example')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should show the title of the application in the header', () => {
    // Act
    renderAt('/sign-in')

    // Assert
    expect(screen.getByRole('banner')).toHaveTextContent('Beauty Salon Portal')
  })

  it('should say that a page does not exist and lead back to the root', () => {
    // Act
    renderAt('/no-such-page')

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: 'ページが見つかりません' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'トップへ戻る' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('should offer the way to sign in from the header', () => {
    // Act
    renderAt('/no-such-page')

    // Assert
    expect(
      within(screen.getByRole('banner')).getByRole('link', {
        name: 'サインイン',
      }),
    ).toHaveAttribute('href', '/sign-in')
  })

  it('should show the sign-in screen after that link is pressed', () => {
    // Arrange
    renderAt('/no-such-page')

    // Act
    fireEvent.click(
      within(screen.getByRole('banner')).getByRole('link', {
        name: 'サインイン',
      }),
    )

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: 'サインイン' }),
    ).toHaveFocus()
    expect(document.title).toBe('サインイン | Beauty Salon Portal')
  })

  it('should show the sign-in screen at its address', () => {
    // Act
    renderAt('/sign-in')

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: 'サインイン' }),
    ).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: 'メールアドレス' }),
    ).toBeVisible()
  })

  it('should show under the sign-in form the ways on for somebody who cannot sign in', () => {
    // Act
    renderAt('/sign-in')

    // Assert
    const main = within(screen.getByRole('main'))
    expect(
      main.getByRole('link', { name: 'パスワードを忘れた場合' }),
    ).toHaveAttribute('href', '/forgot-password')
    expect(
      main.getByRole('link', { name: 'アカウントを登録' }),
    ).toHaveAttribute('href', '/register')
    expect(
      screen
        .getByRole('button', { name: 'サインイン' })
        .compareDocumentPosition(
          main.getByRole('link', { name: 'パスワードを忘れた場合' }),
        ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it.each([
    ['/register', 'アカウントの登録'],
    ['/forgot-password', 'パスワードの再設定'],
    ['/verify-email', 'メールアドレスの確認'],
    // The two that a mailed link opens say so to somebody who comes without one
    ['/reset-password', 'このリンクは使えません'],
    ['/accept-staff-invitation', 'このリンクは使えません'],
  ])('should show the screen of an account at %s', (path, title) => {
    // Act
    renderAt(path)

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(document.title).toBe(`${title} | Beauty Salon Portal`)
  })

  it.each([
    [BOOKING_PATH, '予約するには、サインインしてください。'],
    [OWN_BOOKING_PATH, '予約を確認するには、サインインしてください。'],
  ])(
    'should ask for the sign-in at %s, a screen of a customer, and say what for',
    (path, notice) => {
      // Act
      renderAt(path)

      // Assert
      const main = within(screen.getByRole('main'))
      expect(
        screen.getByRole('heading', { level: 1, name: 'サインイン' }),
      ).toBeVisible()
      expect(main.getByText(notice)).toBeVisible()
      expect(
        main.getByRole('link', { name: 'アカウントを登録' }),
      ).toHaveAttribute('href', '/register')
      expect(
        main.getByRole('link', { name: 'パスワードを忘れた場合' }),
      ).toHaveAttribute('href', '/forgot-password')
    },
  )

  it('should begin with a link that skips to the main content', () => {
    // Act
    renderAt('/sign-in')

    // Assert
    expect(screen.getAllByRole('link').at(0)).toHaveAccessibleName('本文へ移動')
    expect(screen.getAllByRole('link').at(0)).toHaveAttribute(
      'href',
      `#${screen.getByRole('main').id}`,
    )
  })

  it.each(['staging', 'development', 'test', 'localhost'])(
    'should name the %s environment',
    (mode) => {
      // Arrange
      vi.stubEnv('VITE_MODE', mode)

      // Act
      renderAt('/sign-in')

      // Assert
      expect(screen.getByText(mode)).toBeVisible()
    },
  )

  it('should not name the environment in production', () => {
    // Act
    renderAt('/sign-in')

    // Assert
    expect(screen.queryByText('production')).not.toBeInTheDocument()
  })

  it.each([
    '/no-such-page',
    '/sign-in',
    '/register',
    '/forgot-password',
    '/verify-email',
    '/reset-password',
    '/accept-staff-invitation',
    BOOKING_PATH,
    OWN_BOOKING_PATH,
  ])('should have no accessibility violations at %s', async (path) => {
    // Arrange
    vi.stubEnv('VITE_MODE', 'staging')
    renderAt(path)

    // Act
    const violations = await findAccessibilityViolations()

    // Assert
    expect(violations).toEqual([])
  })
})
