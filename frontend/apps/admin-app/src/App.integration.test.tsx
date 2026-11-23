import { applications } from '@beauty-salon-frontend/brand'
import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import { heading } from '@beauty-salon-frontend/testing/screens'
import {
  CUSTOMER,
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  STYLIST,
} from '@beauty-salon-frontend/testing/seed'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from './__tests__/screens'

const TITLE = applications.admin.name

/** The first screen of a member of the staff: the bookings of their salon */
const BOOKINGS = '予約台帳'

describe('App, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['the owner of a salon', OWNER, BOOKINGS, '予約'],
    ['a manager', MANAGER, BOOKINGS, '予約'],
    ['a member of the staff', STYLIST, BOOKINGS, '予約'],
    ['the operator of the platform', OPERATOR, 'サロンを選ぶ', 'サロンを選ぶ'],
  ])(
    'should let %s in: %s, at the first screen of the role',
    async (_, email, first, link) => {
      // Arrange
      renderAt('/')

      // Act
      await signInAs(email)

      // Assert
      expect(await heading(first)).toHaveFocus()
      expect(within(screen.getByRole('banner')).getByText(email)).toBeVisible()
      expect(document.title).toBe(`${first} | ${TITLE}`)
      // The links of the header are those of the role, at the address it was led to
      expect(
        within(
          await screen.findByRole('navigation', { name: 'メインメニュー' }),
        ).getByRole('link', { name: link }),
      ).toHaveAttribute('aria-current', 'page')
    },
  )

  it.each([['a customer', CUSTOMER]])(
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
    expect(await heading(BOOKINGS)).toHaveFocus()
    expect(within(screen.getByRole('banner')).getByText(OWNER)).toBeVisible()
  })

  it('should lead from the header to the security of the account, whose screens the application has', async () => {
    // Arrange
    renderAt('/')
    await signInAs(OWNER)
    await heading(BOOKINGS)

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

describe('App on a page in English, against the API', () => {
  /** The page turns English once somebody is signed in: the sign-in screen is tested in Japanese */
  const chooseEnglish = (): void => {
    act(() => {
      languageStore.choose('en')
    })
  }

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('should show the operator of the platform the salons to choose from in English', async () => {
    // Arrange
    renderAt('/')
    await signInAs(OPERATOR)
    await heading('サロンを選ぶ')

    // Act
    chooseEnglish()

    // Assert
    expect(await heading('Choose a salon')).toBeVisible()
    const keyword = screen.getByRole('searchbox', { name: 'Keyword' })
    expect(keyword).toHaveAccessibleDescription(
      'Words in the name or the introduction of a salon. Leave it empty to list every salon.',
    )
    // testing-library does not know the role of `search`
    expect(keyword.closest('search')).toHaveAttribute(
      'aria-label',
      'Search for a salon',
    )
    expect(
      within(await screen.findByRole('table', { name: 'Salons' }))
        .getAllByRole('columnheader')
        .map(({ textContent }) => textContent),
    ).toEqual(['Salon', 'Address', 'Bookings'])
  })

  it('should say in English that the salon of an address is not there', async () => {
    // Arrange
    renderAt('/salons/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01/bookings')
    await signInAs(OWNER)
    await heading('サロンが見つかりません')

    // Act
    chooseEnglish()

    // Assert
    expect(await heading('Salon not found')).toBeVisible()
    expect(
      screen.getByText(
        'Check that the address is correct. A deleted salon cannot be shown.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Back to the top' }),
    ).toHaveAttribute('href', '/')
  })

  it('should tell a member of the staff of another salon in English that its bookings are not theirs to see', async () => {
    // Arrange
    renderAt(`/salons/${await salonIdOf(OSAKA)}/bookings`)
    await signInAs(STYLIST)
    await screen.findByText(
      'このサロンの予約は、見られません。予約を見られるのは、そのサロンのスタッフと、管理者です。',
    )

    // Act
    chooseEnglish()

    // Assert
    expect(
      screen.getByText(
        'You cannot see the bookings of this salon. Only the staff of the salon and the administrators can.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Go to the bookings of your salon' }),
    ).toHaveAttribute('href', '/')
  })
})
