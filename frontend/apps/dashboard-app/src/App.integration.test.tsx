import { applications } from '@beauty-salon-frontend/brand'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { signInAs } from '@beauty-salon-frontend/testing/api'
import { heading } from '@beauty-salon-frontend/testing/screens'
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

const TITLE = applications.dashboard.name

describe('App, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['the owner of a salon', OWNER, '売上レポート'],
    ['a manager', MANAGER, '売上レポート'],
    ['the operator of the platform', OPERATOR, 'サロンを選ぶ'],
  ])('should let %s in: %s, at %s', async (_, email, start) => {
    // Arrange
    renderAt('/')

    // Act
    await signInAs(email)

    // Assert
    expect(await heading(start)).toHaveFocus()
    expect(within(screen.getByRole('banner')).getByText(email)).toBeVisible()
    expect(document.title).toBe(`${start} | ${TITLE}`)
    // The links of the header are those of the role, at the address it was led to
    expect(
      within(
        await screen.findByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: start }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    ['a member of the staff', STYLIST],
    ['a customer', CUSTOMER],
  ])(
    'should tell %s that the application is not for them: %s',
    async (_, email) => {
      // Arrange
      renderAt('/')

      // Act
      await signInAs(email)

      // Assert
      expect(
        await heading('このアプリケーションは利用できません'),
      ).toBeVisible()
      expect(
        screen.queryByRole('heading', { name: TITLE }),
      ).not.toBeInTheDocument()
    },
  )

  it('should show the screen of the address that was asked for after signing in', async () => {
    // Arrange
    renderAt('/no-such-page')
    await heading('サインイン')

    // Act
    await signInAs(OWNER)

    // Assert
    expect(await heading('ページが見つかりません')).toBeVisible()
    expect(document.title).toBe(`ページが見つかりません | ${TITLE}`)
  })

  it('should move between its screens without leaving the application or the session', async () => {
    // Arrange
    renderAt('/no-such-page')
    await signInAs(OWNER)
    await heading('ページが見つかりません')

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'トップへ戻る' }))

    // Assert
    expect(await heading('売上レポート')).toHaveFocus()
    expect(within(screen.getByRole('banner')).getByText(OWNER)).toBeVisible()
  })

  it('should lead from the header to the security of the account, whose screens the application has', async () => {
    // Arrange
    renderAt('/')
    await signInAs(OWNER)
    await heading('売上レポート')

    // Act
    await userEvent.click(
      within(screen.getByRole('banner')).getByRole('link', {
        name: 'アカウントの安全',
      }),
    )

    // Assert
    expect(await heading('アカウントの安全')).toHaveFocus()
    expect(
      await screen.findByText('1 台の端末でサインインしています'),
    ).toBeVisible()
  })

  it.each(['/', '/no-such-page'])(
    'should have no accessibility violations at %s for a signed-in user',
    async (path) => {
      // Arrange
      vi.stubEnv('VITE_MODE', 'staging')
      renderAt(path)
      await signInAs(OWNER)
      await screen.findByRole('button', { name: 'サインアウト' })

      // Act
      const violations = await findAccessibilityViolations()

      // Assert
      expect(violations).toEqual([])
    },
  )
})
