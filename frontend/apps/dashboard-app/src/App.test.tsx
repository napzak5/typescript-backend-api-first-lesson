import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )

/** Nobody is signed in: what the application shows without asking the API. */
describe('App', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', 'Beauty Salon Dashboard')
    vi.stubEnv('VITE_MODE', 'production')
    vi.stubEnv('VITE_PORTAL_APP_URL', 'https://portal.salon.example')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should show the title of the application in the header', () => {
    // Act
    renderAt('/')

    // Assert
    expect(screen.getByRole('banner')).toHaveTextContent(
      'Beauty Salon Dashboard',
    )
  })

  it.each(['/', '/no-such-page'])(
    'should show the sign-in screen at %s to somebody who is not signed in',
    (path) => {
      // Act
      renderAt(path)

      // Assert
      expect(
        screen.getByRole('heading', { level: 1, name: 'サインイン' }),
      ).toBeVisible()
      expect(screen.getAllByRole('heading')).toHaveLength(1)
      expect(document.title).toBe('サインイン | Beauty Salon Dashboard')
    },
  )

  it('should show nothing of an account in the header to somebody who is not signed in', () => {
    // Act
    renderAt('/')

    // Assert
    expect(screen.getByRole('banner')).toHaveTextContent(
      /^Beauty Salon Dashboard$/,
    )
  })

  it('should lead somebody who forgot the password to the portal, where a password is set anew', () => {
    // Act
    renderAt('/')

    // Assert
    const help = screen.getByRole('link', { name: 'パスワードを忘れた場合' })
    expect(help).toHaveAttribute(
      'href',
      'https://portal.salon.example/forgot-password',
    )
    expect(
      screen
        .getByRole('button', { name: 'サインイン' })
        .compareDocumentPosition(help),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('should begin with a link that skips to the main content', () => {
    // Act
    renderAt('/')

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
      renderAt('/')

      // Assert
      expect(screen.getByText(mode)).toBeVisible()
    },
  )

  it('should not name the environment in production', () => {
    // Act
    renderAt('/')

    // Assert
    expect(screen.queryByText('production')).not.toBeInTheDocument()
  })

  it('should have no accessibility violations', async () => {
    // Arrange
    vi.stubEnv('VITE_MODE', 'staging')
    renderAt('/')

    // Act
    const violations = await findAccessibilityViolations()

    // Assert
    expect(violations).toEqual([])
  })
})
