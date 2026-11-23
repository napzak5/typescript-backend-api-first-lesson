import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { signInAs, testApi } from '@beauty-salon-frontend/testing/api'
import {
  heading,
  renderApplicationAt,
} from '@beauty-salon-frontend/testing/screens'
import {
  CUSTOMER,
  MANAGER,
  OPERATOR,
  OWNER,
  STYLIST,
} from '@beauty-salon-frontend/testing/seed'
import { PageHeader } from '@beauty-salon-frontend/ui'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { describe, expect, it } from 'vitest'
import { isAtOrBelow } from '../utils/addresses'
import type { NavigationOf } from './app-frame'
import {
  StaffApplication,
  type StaffApplicationProps,
} from './staff-application'

const TITLE = 'Kushi Staff'

/** The first screen of the application */
const START = 'はじめの画面'

/** The links of an application that names the role it was asked for, and has one screen besides the first. */
const navigationFor: NavigationOf = (role, pathname) =>
  role === undefined
    ? []
    : [
        {
          href: '/',
          label: { en: `Start of ${role}`, ja: `${role} の${START}` },
          current: pathname === '/',
        },
        {
          href: '/reports',
          label: { en: 'Reports', ja: 'レポート' },
          current: isAtOrBelow(pathname, '/reports'),
        },
      ]

/** An application for those who run a salon and for the operator of the platform. */
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
      <Route path='/' element={<PageHeader title={START} />} />
      <Route path='/reports/*' element={<PageHeader title='レポート' />} />
    </StaffApplication>,
    path,
  )

const sessionCountOfTheApi = async (): Promise<unknown> =>
  testApi().query('select count(*)::int as count from sessions')

/** The links of the header that lead to the screens, with the one that is marked as shown. */
const linksOfTheHeader = (): [string | null, string | null, string | null][] =>
  within(screen.getByRole('navigation'))
    .getAllByRole('link')
    .map((link) => [
      link.textContent,
      link.getAttribute('href'),
      link.getAttribute('aria-current'),
    ])

describe('StaffApplication, against the API', () => {
  it.each<[string, string, string]>([
    ['the owner of a salon', OWNER, 'owner'],
    ['a manager', MANAGER, 'manager'],
    ['the operator of the platform', OPERATOR, 'admin'],
  ])(
    'should let %s in (%s), and give the header the links of the role %s',
    async (_case, email, role) => {
      // Arrange
      renderAt('/')

      // Act
      await signInAs(email)

      // Assert
      expect(await heading(START)).toHaveFocus()
      expect(within(screen.getByRole('banner')).getByText(email)).toBeVisible()
      expect(document.title).toBe(`${START} | ${TITLE}`)
      expect(linksOfTheHeader()).toEqual([
        [`${role} の${START}`, '/', 'page'],
        ['レポート', '/reports', null],
      ])
    },
  )

  it.each<[string, string]>([
    ['a member of the staff', STYLIST],
    ['a customer', CUSTOMER],
  ])(
    'should tell %s that the application is not for them: %s',
    async (_case, email) => {
      // Arrange
      renderAt('/')

      // Act
      await signInAs(email)

      // Assert
      expect(
        await heading('このアプリケーションは利用できません'),
      ).toBeVisible()
      expect(
        screen.queryByRole('heading', { name: START }),
      ).not.toBeInTheDocument()
    },
  )

  it('should show the screen of the address that was asked for after signing in, with the links of that address', async () => {
    // Arrange
    renderAt('/reports/2026-11')
    await heading('サインイン')

    // Act
    await signInAs(OWNER)

    // Assert
    expect(await heading('レポート')).toHaveFocus()
    expect(linksOfTheHeader()).toEqual([
      [`owner の${START}`, '/', null],
      ['レポート', '/reports', 'page'],
    ])
  })

  it('should say of an address that is none of the application that there is no such page', async () => {
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
    expect(await heading(START)).toHaveFocus()
    expect(within(screen.getByRole('banner')).getByText(OWNER)).toBeVisible()
  })

  it('should lead from the header to the security of the account, change the password there and come back to it', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/')
    await signInAs(OWNER)
    await heading(START)

    // Act
    await user.click(
      within(screen.getByRole('banner')).getByRole('link', {
        name: 'アカウントの安全',
      }),
    )
    expect(await heading('アカウントの安全')).toHaveFocus()
    await screen.findByText('1 台の端末でサインインしています')
    expect(await findAccessibilityViolations()).toEqual([])
    await user.click(screen.getByRole('link', { name: 'パスワードを変更する' }))
    expect(await heading('パスワードを変更する')).toHaveFocus()
    await user.type(
      screen.getByLabelText('現在のパスワード'),
      testApi().seedPassword,
    )
    await user.type(
      screen.getByLabelText('新しいパスワード'),
      'aoi sora to shiroi kumo no aida',
    )
    await user.click(
      screen.getByRole('button', { name: 'パスワードを変更する' }),
    )

    // Assert
    expect(await heading('アカウントの安全')).toHaveFocus()
    expect(
      await screen.findByText(
        'パスワードを変更しました。この端末のほかは、すべての端末でサインアウトしました。変更したことを、メールでお知らせしました。',
      ),
    ).toBeVisible()
    expect(await testApi().mails()).toEqual([
      expect.objectContaining({
        to: OWNER,
        subject: 'パスワードが変更されました',
      }),
    ])
  })

  it('should lead back from the change of the password to the security of the account without changing it', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/account/security/password')
    await signInAs(OWNER)
    await heading('パスワードを変更する')

    // Act
    await user.click(screen.getByRole('link', { name: 'やめる' }))

    // Assert
    expect(await heading('アカウントの安全')).toHaveFocus()
    expect(await testApi().mails()).toEqual([])
  })

  it.each<[string, string, string]>([
    ['the security of the account', '/account/security', 'アカウントの安全'],
    [
      'the change of the password',
      '/account/security/password',
      'パスワードを変更する',
    ],
    [
      'the set-up of the second factor',
      '/account/security/two-factor',
      '2 要素認証を設定する',
    ],
  ])('should have %s at %s', async (_case, path, name) => {
    // Arrange
    renderAt(path)

    // Act
    await signInAs(OWNER)

    // Assert
    expect(await heading(name)).toHaveFocus()
  })

  it('should set the second factor up from the security of the account, and show it on there', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/account/security')
    await signInAs(OWNER)
    await heading('アカウントの安全')

    // Act
    await user.click(
      within(
        await screen.findByRole('region', { name: '2 要素認証' }),
      ).getByRole('link', { name: '2 要素認証を設定する' }),
    )
    expect(await heading('2 要素認証を設定する')).toHaveFocus()
    await user.type(
      await screen.findByLabelText('パスワード'),
      testApi().seedPassword,
    )
    await user.click(screen.getByRole('button', { name: '設定を始める' }))
    const secret = (
      within(
        await screen.findByRole('region', { name: '認証アプリに登録する' }),
      ).getByRole('code').textContent ?? ''
    ).replaceAll(' ', '')
    await user.type(
      screen.getByLabelText('認証アプリのコード'),
      await testApi().authenticatorCode(secret),
    )
    await user.click(
      screen.getByRole('button', { name: '2 要素認証を有効にする' }),
    )
    expect(
      await screen.findByRole('list', { name: 'バックアップコード' }),
    ).toBeVisible()
    expect(await findAccessibilityViolations()).toEqual([])
    await user.click(
      screen.getByRole('link', { name: 'アカウントの安全へ戻る' }),
    )

    // Assert: what was read before the set-up is not shown, not even at once
    expect(await heading('アカウントの安全')).toHaveFocus()
    const twoFactor = await screen.findByRole('region', { name: '2 要素認証' })
    expect(within(twoFactor).queryByText('未設定')).toBeNull()
    expect(within(twoFactor).getByText('有効')).toBeVisible()
    expect(
      within(twoFactor).getByRole('button', {
        name: '2 要素認証を無効にする',
      }),
    ).toBeVisible()
  })

  it('should sign out from the header and show the sign-in screen again', async () => {
    // Arrange
    renderAt('/')
    await signInAs(OWNER)
    await heading(START)

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'サインアウト' }))

    // Assert
    expect(await heading('サインイン')).toHaveFocus()
    expect(
      within(screen.getByRole('main')).getByRole('status'),
    ).toHaveTextContent('サインアウトしました。')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(await sessionCountOfTheApi()).toEqual([{ count: 0 }])
  })

  it.each(['/', '/no-such-page'])(
    'should have no accessibility violations at %s for a signed-in user',
    async (path) => {
      // Arrange
      renderAt(path, 'staging')
      await signInAs(OWNER)
      await screen.findByRole('button', { name: 'サインアウト' })

      // Act
      const violations = await findAccessibilityViolations()

      // Assert
      expect(violations).toEqual([])
    },
  )
})
