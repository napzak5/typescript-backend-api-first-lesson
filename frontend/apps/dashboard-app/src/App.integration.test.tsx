import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

const TITLE = 'Beauty Salon Dashboard'
const OWNER = 'owner@beautysalon.jp'

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

  it.each([
    ['the owner of a salon', 'owner@beautysalon.jp'],
    ['a manager', 'manager@beautysalon.jp'],
    ['the operator of the platform', 'admin@beautysalon.jp'],
  ])('should let %s in: %s', async (_, email) => {
    // Arrange
    renderAt('/')

    // Act
    await signInAs(email)

    // Assert
    expect(await heading(TITLE)).toHaveFocus()
    expect(within(screen.getByRole('banner')).getByText(email)).toBeVisible()
    expect(document.title).toBe(TITLE)
  })

  it.each([
    ['a member of the staff', 'stylist1@beautysalon.jp'],
    ['a customer', 'customer1@example.com'],
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
    expect(await heading(TITLE)).toHaveFocus()
    expect(within(screen.getByRole('banner')).getByText(OWNER)).toBeVisible()
  })

  it('should lead from the header to the security of the account, change the password there and come back to it', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/')
    await signInAs(OWNER)
    await heading(TITLE)

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
    await heading(TITLE)

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'サインアウト' }))

    // Assert
    expect(await heading('サインイン')).toHaveFocus()
    expect(
      within(screen.getByRole('main')).getByRole('status'),
    ).toHaveTextContent('サインアウトしました。')
    expect(await sessionCountOfTheApi()).toEqual([{ count: 0 }])
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
