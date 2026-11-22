import {
  authCrudEnableTwoFactor,
  authCrudVerifyTwoFactor,
} from '@beauty-salon-frontend/api-client'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import {
  AppShell,
  NotificationProvider,
  PageHeader,
} from '@beauty-salon-frontend/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RequireSession,
  type RequireSessionProps,
  SessionAccount,
  signIn,
  signOut,
} from '.'

const CUSTOMER = 'customer1@example.com'
const STYLIST = 'stylist1@beautysalon.jp'
const LOGIN = '/api/v1/auth/login'

/** An application whose one screen is for the roles it is given. */
const renderApplication = (
  roles: RequireSessionProps['roles'] = ['customer'],
  signInScreen: Pick<RequireSessionProps, 'signInNotice' | 'signInHelp'> = {},
) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <NotificationProvider>
        <AppShell title='Kushi' account={<SessionAccount />}>
          <RequireSession roles={roles} {...signInScreen}>
            <PageHeader title='マイページ' />
          </RequireSession>
        </AppShell>
      </NotificationProvider>
    </QueryClientProvider>,
  )

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

/** Fills in the first step of the form and sends it. */
const enterCredentials = async (
  email: string,
  password = testApi().seedPassword,
): Promise<void> => {
  const user = userEvent.setup()
  await user.type(
    await screen.findByRole('textbox', { name: 'メールアドレス' }),
    email,
  )
  await user.type(screen.getByLabelText('パスワード'), password)
  await user.click(screen.getByRole('button', { name: 'サインイン' }))
}

const enterCode = async (code: string): Promise<void> => {
  const user = userEvent.setup()
  const field = await screen.findByRole('textbox', { name: '認証コード' })
  await user.clear(field)
  await user.type(field, code)
  await user.click(screen.getByRole('button', { name: 'サインイン' }))
}

/** The sessions the API keeps, as its database has them. */
const sessionsOfTheApi = () =>
  testApi().query(
    `select u.email, s."refreshExpiresAt" - now() > interval '1 day' as "staysSignedIn"
       from sessions s join users u on u.id = s."userId"`,
  )

/**
 * Turns on two-factor authentication for a seeded account, as its owner
 * would in the settings, and signs out again. Resolves to the secret of the
 * authenticator app and to the backup codes.
 */
const setUpTwoFactor = async (
  email: string,
): Promise<{ secret: string; backupCodes: string[] }> => {
  const password = testApi().seedPassword
  await signIn({ email, password, rememberMe: false, twoFactorCode: null })
  const setUp = await authCrudEnableTwoFactor({ password })
  expect(setUp.status).toBe(200)
  const { secret, backupCodes } =
    setUp.status === 200 ? setUp.data.data : { secret: '', backupCodes: [] }
  const confirmed = await authCrudVerifyTwoFactor({
    code: await testApi().authenticatorCode(secret),
  })
  expect(confirmed.status).toBe(204)
  await signOut()

  return { secret, backupCodes }
}

describe('signing in on the screen, against the API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should show the sign-in screen in place of a screen that needs a session', async () => {
    // Act
    renderApplication()

    // Assert
    expect(await heading('サインイン')).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'マイページ' }),
    ).not.toBeInTheDocument()
    expect(document.title).toBe('サインイン | Kushi')
    expect(await findAccessibilityViolations()).toEqual([])
  })

  it('should say why an account is asked for and show the ways on of the application, as long as nobody is signed in', async () => {
    // Arrange
    const NOTICE = '予約の履歴は、サインインすると見られます。'
    renderApplication(['customer'], {
      signInNotice: NOTICE,
      signInHelp: <a href='/forgot-password'>パスワードを忘れた場合</a>,
    })
    await heading('サインイン')
    const main = screen.getByRole('main')
    const asked = {
      statuses: within(main)
        .getAllByRole('status')
        .map((status) => status.textContent)
        .filter((text) => text !== ''),
      // The reason comes before the form, the ways on after it
      order: [NOTICE, 'メールアドレス', 'パスワードを忘れた場合'].map((text) =>
        (main.textContent ?? '').indexOf(text),
      ),
      help: within(main)
        .getByRole('link', { name: 'パスワードを忘れた場合' })
        .getAttribute('href'),
      violations: await findAccessibilityViolations(),
    }

    // Act
    await enterCredentials(CUSTOMER)

    // Assert
    expect(await heading('マイページ')).toBeVisible()
    expect(asked).toEqual({
      statuses: [NOTICE],
      order: asked.order.toSorted((one, other) => one - other),
      help: '/forgot-password',
      violations: [],
    })
    expect(asked.order).not.toContain(-1)
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'パスワードを忘れた場合' }),
    ).not.toBeInTheDocument()
  })

  it('should show the screen that was asked for after signing in, and say who is signed in', async () => {
    // Arrange
    renderApplication()

    // Act
    await enterCredentials(CUSTOMER)

    // Assert
    expect(await heading('マイページ')).toHaveFocus()
    expect(document.title).toBe('マイページ | Kushi')
    expect(within(screen.getByRole('banner')).getByText(CUSTOMER)).toBeVisible()
    expect(
      within(screen.getByRole('main')).getByRole('status'),
    ).toHaveTextContent('サインインしました。')
    expect(await sessionsOfTheApi()).toEqual([
      { email: CUSTOMER, staysSignedIn: false },
    ])
    expect(await findAccessibilityViolations()).toEqual([])
  })

  it('should keep the user signed in for longer when they ask for it', async () => {
    // Arrange
    renderApplication()
    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: '30 日間サインインしたままにする',
      }),
    )

    // Act
    await enterCredentials(CUSTOMER)

    // Assert
    await heading('マイページ')
    expect(await sessionsOfTheApi()).toEqual([
      { email: CUSTOMER, staysSignedIn: true },
    ])
  })

  it('should say that the credentials are wrong, without saying which, and stay on the form', async () => {
    // Arrange
    renderApplication()

    // Act
    await enterCredentials(CUSTOMER, 'not the password')

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'メールアドレスまたはパスワードが正しくありません。',
    )
    expect(screen.getByRole('textbox', { name: 'メールアドレス' })).toHaveValue(
      CUSTOMER,
    )
    expect(
      screen.queryByRole('heading', { name: 'マイページ' }),
    ).not.toBeInTheDocument()
    expect(await sessionsOfTheApi()).toEqual([])
    expect(await findAccessibilityViolations()).toEqual([])
  })

  it('should answer an unknown address as it answers a wrong password', async () => {
    // Arrange
    renderApplication()

    // Act
    await enterCredentials('nobody@example.com')

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'メールアドレスまたはパスワードが正しくありません。',
    )
  })

  it('should say what is missing at the fields, and send nothing', async () => {
    // Arrange
    const sent = vi.spyOn(globalThis, 'fetch')
    renderApplication()
    const submit = await screen.findByRole('button', { name: 'サインイン' })

    // Act
    await userEvent.click(submit)

    // Assert
    const email = screen.getByRole('textbox', { name: 'メールアドレス' })
    expect(email).toHaveAccessibleDescription(
      'メールアドレスを入力してください。',
    )
    expect(email).toHaveFocus()
    expect(screen.getByLabelText('パスワード')).toHaveAccessibleDescription(
      'パスワードを入力してください。',
    )
    expect(
      sent.mock.calls.filter(([url]) => String(url).endsWith(LOGIN)),
    ).toEqual([])
    expect(await findAccessibilityViolations()).toEqual([])
  })

  it('should say that an address is not one, and send nothing', async () => {
    // Arrange
    const sent = vi.spyOn(globalThis, 'fetch')
    renderApplication()

    // Act
    await enterCredentials('customer1')

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'メールアドレス' }),
    ).toHaveAccessibleDescription(
      'メールアドレスは、hanako@example.com のような形で入力してください。',
    )
    expect(
      sent.mock.calls.filter(([url]) => String(url).endsWith(LOGIN)),
    ).toEqual([])
  })

  describe('with two-factor authentication', () => {
    it('should ask for the code in a second step, and sign in with the code of the authenticator app', async () => {
      // Arrange
      const { secret } = await setUpTwoFactor(CUSTOMER)
      renderApplication()

      // Act
      await enterCredentials(CUSTOMER)
      const code = await screen.findByRole('textbox', { name: '認証コード' })
      const focusedAtTheCode = document.activeElement === code
      const violations = await findAccessibilityViolations()
      await enterCode(await testApi().authenticatorCode(secret, 1))

      // Assert
      expect(focusedAtTheCode).toBe(true)
      expect(violations).toEqual([])
      expect(await heading('マイページ')).toBeVisible()
      expect(await sessionsOfTheApi()).toEqual([
        { email: CUSTOMER, staysSignedIn: false },
      ])
    })

    it('should say that a code is wrong, and sign in with a right one after it', async () => {
      // Arrange
      const { backupCodes } = await setUpTwoFactor(CUSTOMER)
      renderApplication()
      await enterCredentials(CUSTOMER)

      // Act
      await enterCode('000000')
      const field = await screen.findByRole('textbox', { name: '認証コード' })
      await waitFor(() =>
        expect(field).toHaveAccessibleDescription(
          /コードが正しくありません。新しいコードを入力してください。/,
        ),
      )
      const signedInAfterTheWrongCode = await sessionsOfTheApi()
      await enterCode(backupCodes[0] ?? '')

      // Assert
      expect(signedInAfterTheWrongCode).toEqual([])
      expect(await heading('マイページ')).toBeVisible()
    })

    it('should say that the code is missing, and send nothing', async () => {
      // Arrange
      await setUpTwoFactor(CUSTOMER)
      renderApplication()
      await enterCredentials(CUSTOMER)
      const field = await screen.findByRole('textbox', { name: '認証コード' })
      const sent = vi.spyOn(globalThis, 'fetch')

      // Act
      await userEvent.click(screen.getByRole('button', { name: 'サインイン' }))

      // Assert
      expect(field).toHaveAccessibleDescription(
        /認証コードを入力してください。/,
      )
      expect(sent).not.toHaveBeenCalled()
    })

    it('should lead back to the first step', async () => {
      // Arrange
      await setUpTwoFactor(CUSTOMER)
      renderApplication()
      await enterCredentials(CUSTOMER)

      // Act
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'メールアドレスの入力に戻る',
        }),
      )

      // Assert
      expect(
        screen.getByRole('textbox', { name: 'メールアドレス' }),
      ).toBeVisible()
      expect(
        screen.queryByRole('textbox', { name: '認証コード' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('with a session', () => {
    it('should show the screen at once to a user who was signed in before the page loaded', async () => {
      // Arrange
      await signIn({
        email: CUSTOMER,
        password: testApi().seedPassword,
        rememberMe: false,
        twoFactorCode: null,
      })

      // Act
      renderApplication()

      // Assert
      expect(await heading('マイページ')).toBeVisible()
      expect(
        screen.queryByRole('heading', { name: 'サインイン' }),
      ).not.toBeInTheDocument()
    })

    it('should sign out from the header: the sign-in screen comes back, and the API ends the session', async () => {
      // Arrange
      renderApplication()
      await enterCredentials(CUSTOMER)
      await heading('マイページ')

      // Act
      await userEvent.click(
        screen.getByRole('button', { name: 'サインアウト' }),
      )

      // Assert
      expect(await heading('サインイン')).toHaveFocus()
      expect(
        within(screen.getByRole('main')).getByRole('status'),
      ).toHaveTextContent('サインアウトしました。')
      expect(screen.queryByText(CUSTOMER)).not.toBeInTheDocument()
      expect(await sessionsOfTheApi()).toEqual([])
    })

    it('should tell an account of another role that the application is not for it', async () => {
      // Arrange
      renderApplication(['customer'])

      // Act
      await enterCredentials(STYLIST)

      // Assert
      expect(
        await heading('このアプリケーションは利用できません'),
      ).toBeVisible()
      expect(
        screen.getByText(`${STYLIST} のアカウントでは利用できません。`, {
          exact: false,
        }),
      ).toBeVisible()
      expect(
        screen.queryByRole('heading', { name: 'マイページ' }),
      ).not.toBeInTheDocument()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should let an account of another role sign out where it is told so', async () => {
      // Arrange
      renderApplication(['customer'])
      await enterCredentials(STYLIST)
      await heading('このアプリケーションは利用できません')

      // Act
      await userEvent.click(
        within(screen.getByRole('main')).getByRole('button', {
          name: 'サインアウト',
        }),
      )

      // Assert
      expect(await heading('サインイン')).toBeVisible()
      expect(await sessionsOfTheApi()).toEqual([])
    })

    it('should let a role in that the screen is for', async () => {
      // Arrange
      renderApplication(['owner', 'manager', 'staff', 'admin'])

      // Act
      await enterCredentials(STYLIST)

      // Assert
      expect(await heading('マイページ')).toBeVisible()
    })
  })
})
