import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

describe('App', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', 'Beauty Salon Admin')
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should show the title of the application in the header', () => {
    // Act
    renderAt('/')

    // Assert
    expect(screen.getByRole('banner')).toHaveTextContent('Beauty Salon Admin')
  })

  it('should show the page of the root path', () => {
    // Act
    renderAt('/')

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: 'Beauty Salon Admin' }),
    ).toBeVisible()
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

  it.each(['/', '/no-such-page'])(
    'should have no accessibility violations at %s',
    async (path) => {
      // Arrange
      vi.stubEnv('VITE_MODE', 'staging')
      renderAt(path)

      // Act
      const violations = await findAccessibilityViolations()

      // Assert
      expect(violations).toEqual([])
    },
  )
})
