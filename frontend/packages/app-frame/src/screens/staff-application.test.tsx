import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { renderApplicationAt } from '@beauty-salon-frontend/testing/screens'
import { PageHeader } from '@beauty-salon-frontend/ui'
import { screen } from '@testing-library/react'
import { Route } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import type { NavigationOf } from './app-frame'
import {
  StaffApplication,
  type StaffApplicationProps,
} from './staff-application'

const TITLE = 'Kushi Staff'

/** Somebody who is not signed in is led nowhere. */
const navigationFor: NavigationOf = (role) =>
  role === undefined
    ? []
    : [{ href: '/', label: 'はじめの画面', current: false }]

const renderAt = (
  path: string,
  environment: StaffApplicationProps['environment'] = 'production',
) =>
  renderApplicationAt(
    <StaffApplication
      title={TITLE}
      roles={['owner', 'manager', 'admin']}
      navigationFor={navigationFor}
      environment={environment}
      portalUrl='https://portal.salon.example'
    >
      <Route path='/' element={<PageHeader title='はじめの画面' />} />
    </StaffApplication>,
    path,
  )

/** Nobody is signed in: what the application shows without asking the API. */
describe('StaffApplication', () => {
  it.each<[string, string]>([
    ['its first screen', '/'],
    ['the security of the account', '/account/security'],
    ['the change of the password', '/account/security/password'],
    ['the set-up of the second factor', '/account/security/two-factor'],
    ['an address that is none of it', '/no-such-page'],
  ])(
    'should show the sign-in screen in the place of %s to somebody who is not signed in',
    (_case, path) => {
      // Act
      renderAt(path)

      // Assert
      expect(
        screen.getByRole('heading', { level: 1, name: 'サインイン' }),
      ).toBeVisible()
      expect(screen.getAllByRole('heading')).toHaveLength(1)
      expect(document.title).toBe(`サインイン | ${TITLE}`)
    },
  )

  it('should show nothing of an account and no link to a screen in the header to somebody who is not signed in', () => {
    // Act
    renderAt('/')

    // Assert
    expect(screen.getByRole('banner').textContent).toBe(TITLE)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
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

  it('should name the environment the page belongs to', () => {
    // Act
    renderAt('/', 'staging')

    // Assert
    expect(screen.getByText('staging')).toBeVisible()
  })

  it('should have no accessibility violations', async () => {
    // Arrange
    renderAt('/', 'staging')

    // Act
    const violations = await findAccessibilityViolations()

    // Assert
    expect(violations).toEqual([])
  })
})

describe('StaffApplication on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should show the sign-in screen, and the way to a new password, in English', () => {
    // Arrange
    languageStore.choose('en')

    // Act
    renderAt('/')

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: 'Sign in' }),
    ).toBeVisible()
    expect(document.title).toBe(`Sign in | ${TITLE}`)
    expect(
      screen.getByRole('link', { name: 'Forgot your password?' }),
    ).toHaveAttribute('href', 'https://portal.salon.example/forgot-password')
  })
})
