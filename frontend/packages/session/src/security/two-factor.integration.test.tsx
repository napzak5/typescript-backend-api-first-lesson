import {
  authCrudEnableTwoFactor,
  authCrudLogin,
  authCrudVerifyTwoFactor,
  type ModelsAuthTwoFactorSetupResponse,
} from '@beauty-salon-frontend/api-client'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { queryClientOfATest } from '@beauty-salon-frontend/testing/screens'
import { CUSTOMER } from '@beauty-salon-frontend/testing/seed'
import { AppShell, NotificationProvider } from '@beauty-salon-frontend/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import {
  AccountSecurityScreen,
  RequireSession,
  SessionAccount,
  signIn,
  TwoFactorSetupScreen,
} from '..'

const LOCK = '5 回続けて違うと、15 分間、サインインもできなくなります。'
const NOT_SENT =
  '送信できませんでした。通信の状態を確かめて、もう一度お試しください。'
const CHANGED_ELSEWHERE =
  '2 要素認証の状態が、ほかの画面か端末で変わっていました。いまの状態を読み込み直しました。'

/** An application with somebody signed in, whose one screen is `shown`. */
const renderApplication = (shown: ReactNode) =>
  render(
    <QueryClientProvider client={queryClientOfATest()}>
      <NotificationProvider>
        <AppShell
          title='Kushi Admin'
          account={<SessionAccount securityHref='/account/security' />}
        >
          <RequireSession
            roles={['customer', 'staff', 'manager', 'owner', 'admin']}
          >
            {shown}
          </RequireSession>
        </AppShell>
      </NotificationProvider>
    </QueryClientProvider>,
  )

const renderSetup = () =>
  renderApplication(<TwoFactorSetupScreen securityHref='/account/security' />)

const renderSecurity = () =>
  renderApplication(
    <AccountSecurityScreen
      passwordHref='/account/security/password'
      twoFactorHref='/account/security/two-factor'
    />,
  )

const signInAs = async (email: string): Promise<void> => {
  const signedIn = await signIn({
    email,
    password: testApi().seedPassword,
    rememberMe: false,
    twoFactorCode: null,
  })
  expect(signedIn).toEqual({ type: 'signedIn' })
}

/**
 * Sets the second factor up through the API, and confirms it with the code
 * of this 30 seconds: a code the screen asks for afterwards is that of the
 * next 30 seconds, or a backup code.
 */
const enableThroughApi =
  async (): Promise<ModelsAuthTwoFactorSetupResponse> => {
    const setUp = await authCrudEnableTwoFactor({
      password: testApi().seedPassword,
    })
    expect(setUp.status).toBe(200)
    if (setUp.status !== 200) {
      return { secret: '', qrCodeUrl: '', backupCodes: [] }
    }
    const confirmed = await authCrudVerifyTwoFactor({
      code: await testApi().authenticatorCode(setUp.data.data.secret),
    })
    expect(confirmed.status).toBe(204)

    return setUp.data.data
  }

/** What the database keeps of the second factor of an account. */
const twoFactorOf = async (email: string) => {
  const [row] = await testApi().query(
    `select "twoFactorStatus" as status, "failedLoginAttempts" as "failedAttempts",
            coalesce(jsonb_array_length("backupCodes"), 0) as "backupCodes"
       from users where email = $1`,
    [email],
  )

  return row
}

/** The subjects of the mails the API sent to `to` in this test. */
const subjectsTo = async (to: string): Promise<string[]> =>
  (await testApi().mails())
    .filter((mail) => mail.to === to)
    .map(({ subject }) => subject)

/** Signs in elsewhere with a backup code, through the API: whether the API takes it. */
const signInWithBackupCode = async (code: string): Promise<number> =>
  (
    await authCrudLogin({
      email: CUSTOMER,
      password: testApi().seedPassword,
      rememberMe: false,
      twoFactorCode: code,
    })
  ).status

/**
 * Lets the database refuse `what` on `table`, as a database that fails
 * does: the API answers with an error of the server. The copy of the
 * database goes with the test.
 */
const refuse = async (what: string, table: string): Promise<void> => {
  await testApi().query(
    `create function refuse() returns trigger language plpgsql
       as $$ begin raise exception 'refused by the test'; end $$`,
  )
  await testApi().query(
    `create trigger refuse before ${what} on ${table}
       for each row execute function refuse()`,
  )
}

/**
 * Turns the second factor off in the database, as an operator who resets
 * it, or another device, does.
 */
const turnOffElsewhere = async (): Promise<void> => {
  await testApi().query(
    `update users set "twoFactorStatus" = 'disabled', "twoFactorSecret" = null,
                      "twoFactorLastUsedStep" = null, "backupCodes" = null
      where email = $1`,
    [CUSTOMER],
  )
}

/** What the application says in its notifications. */
const notifications = () =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent)
    .filter((text) => text !== '')

const region = (name: string) => screen.getByRole('region', { name })
const heading = (name: string) => screen.getByRole('heading', { name })

/** The secret the screen shows, as an authenticator app takes it. */
const shownSecret = (): string =>
  (
    within(region('認証アプリに登録する')).getByRole('code').textContent ?? ''
  ).replaceAll(' ', '')

/** Opens the screen that sets the second factor up, and gets past the password. */
const toTheApp = async (user: ReturnType<typeof userEvent.setup>) => {
  renderSetup()
  await user.type(
    await screen.findByLabelText('パスワード'),
    testApi().seedPassword,
  )
  await user.click(screen.getByRole('button', { name: '設定を始める' }))
  await screen.findByRole('heading', { name: '認証アプリに登録する' })
}

const typeAppCode = async (
  user: ReturnType<typeof userEvent.setup>,
  code: string,
) => {
  const field = screen.getByLabelText('認証アプリのコード')
  await user.clear(field)
  await user.type(field, code)
  await user.click(
    screen.getByRole('button', { name: '2 要素認証を有効にする' }),
  )
}

describe('the second factor of an account, against the API', () => {
  describe('the screen that sets it up', () => {
    it('should begin with the password, and say at it that it is wrong, counting the attempt', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      renderSetup()
      const password = await screen.findByLabelText('パスワード')

      // Act
      await user.type(password, 'kirei na kami de dekakeru')
      await user.click(screen.getByRole('button', { name: '設定を始める' }))

      // Assert
      await waitFor(() => expect(password).toBeInvalid())
      expect(password).toHaveAccessibleDescription(
        expect.stringContaining(`パスワードが違います。${LOCK}`),
      )
      expect(password).toHaveFocus()
      expect(await twoFactorOf(CUSTOMER)).toEqual({
        status: 'disabled',
        failedAttempts: 1,
        backupCodes: 0,
      })
    })

    it('should send nothing when the password is missing', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      renderSetup()
      const password = await screen.findByLabelText('パスワード')

      // Act
      await user.click(screen.getByRole('button', { name: '設定を始める' }))

      // Assert
      expect(password).toBeInvalid()
      expect(password).toHaveAccessibleDescription(
        expect.stringContaining('パスワードを入力してください。'),
      )
      expect(await twoFactorOf(CUSTOMER)).toEqual({
        status: 'disabled',
        failedAttempts: 0,
        backupCodes: 0,
      })
    })

    it('should show the QR code and the secret after the password, with the focus on the heading of the step, and the second factor half way', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const user = userEvent.setup()

      // Act
      await toTheApp(user)

      // Assert
      expect(heading('認証アプリに登録する')).toHaveFocus()
      expect(
        within(region('認証アプリに登録する')).getByRole('img', {
          name: '認証アプリで読み取る QR コード',
        }),
      ).toBeVisible()
      expect(shownSecret()).toMatch(/^[A-Z2-7]{32}$/)
      expect(screen.queryByLabelText('パスワード')).toBeNull()
      expect(await twoFactorOf(CUSTOMER)).toEqual({
        status: 'pending',
        failedAttempts: 0,
        backupCodes: 10,
      })
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should say at the code that it is wrong, and keep the second factor half way', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      await toTheApp(user)
      const right = await testApi().authenticatorCode(shownSecret())
      const wrong = right === '000000' ? '111111' : '000000'

      // Act
      await typeAppCode(user, wrong)

      // Assert
      const code = screen.getByLabelText('認証アプリのコード')
      await waitFor(() => expect(code).toBeInvalid())
      expect(code).toHaveAccessibleDescription(
        expect.stringContaining(`コードが違います。`),
      )
      expect(code).toHaveFocus()
      expect(await twoFactorOf(CUSTOMER)).toMatchObject({
        status: 'pending',
        failedAttempts: 1,
      })
    })

    it('should not send a code that is not of six digits', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      await toTheApp(user)

      // Act
      await typeAppCode(user, 'K7M2-PZQX-4HDA-WN3E')

      // Assert
      const code = screen.getByLabelText('認証アプリのコード')
      expect(code).toBeInvalid()
      expect(code).toHaveAccessibleDescription(
        expect.stringContaining('コードは 6 桁の数字です。'),
      )
      expect(await twoFactorOf(CUSTOMER)).toMatchObject({
        status: 'pending',
        failedAttempts: 0,
      })
    })

    it('should turn the second factor on with the code of the app, show the ten backup codes, and mail the account', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      await toTheApp(user)
      const code = await testApi().authenticatorCode(shownSecret())

      // Act: as the app shows it, with a space in its middle
      await typeAppCode(user, `${code.slice(0, 3)} ${code.slice(3)}`)

      // Assert
      expect(
        await screen.findByRole('heading', {
          name: '2 要素認証を有効にしました',
        }),
      ).toHaveFocus()
      const backupCodes = within(
        screen.getByRole('list', { name: 'バックアップコード' }),
      )
        .getAllByRole('listitem')
        .map((item) => item.textContent ?? '')
      expect(backupCodes).toHaveLength(10)
      expect(new Set(backupCodes).size).toBe(10)
      for (const backupCode of backupCodes) {
        expect(backupCode).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){3}$/)
      }
      expect(
        screen.getByRole('link', { name: 'アカウントの安全へ戻る' }),
      ).toHaveAttribute('href', '/account/security')
      expect(await twoFactorOf(CUSTOMER)).toEqual({
        status: 'enabled',
        failedAttempts: 0,
        backupCodes: 10,
      })
      expect(await subjectsTo(CUSTOMER)).toEqual([
        '2 要素認証が有効になりました',
      ])
      expect(await findAccessibilityViolations()).toEqual([])

      // A code that was shown signs in, once
      const [first] = backupCodes
      expect(await signInWithBackupCode(first ?? '')).toBe(200)
      expect(await signInWithBackupCode(first ?? '')).toBe(401)
    })

    it('should tell an account whose second factor is on that there is nothing to set up, and lead back', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      await enableThroughApi()

      // Act
      renderSetup()

      // Assert
      expect(
        await screen.findByRole('heading', {
          name: '2 要素認証は、すでに有効です',
        }),
      ).toBeVisible()
      expect(screen.queryByLabelText('パスワード')).toBeNull()
      expect(
        screen.getByRole('link', { name: 'アカウントの安全へ戻る' }),
      ).toHaveAttribute('href', '/account/security')
    })

    it('should begin anew for an account that was left half way, with a new secret', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const before = await authCrudEnableTwoFactor({
        password: testApi().seedPassword,
      })
      expect(before.status).toBe(200)
      const user = userEvent.setup()

      // Act
      await toTheApp(user)

      // Assert
      const previous = before.status === 200 ? before.data.data.secret : ''
      expect(shownSecret()).not.toBe(previous)
      // The new secret is the one the API now takes
      const code = await testApi().authenticatorCode(shownSecret())
      await typeAppCode(user, code)
      expect(
        await screen.findByRole('heading', {
          name: '2 要素認証を有効にしました',
        }),
      ).toBeVisible()
    })

    it('should say that the second factor was turned on elsewhere when the password is sent, and show that it is on', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      renderSetup()
      const password = await screen.findByLabelText('パスワード')
      // Another tab sets the second factor up meanwhile
      await enableThroughApi()

      // Act
      await user.type(password, testApi().seedPassword)
      await user.click(screen.getByRole('button', { name: '設定を始める' }))

      // Assert
      expect(
        await screen.findByRole('heading', {
          name: '2 要素認証は、すでに有効です',
        }),
      ).toHaveFocus()
      expect(notifications()).toContain(CHANGED_ELSEWHERE)
    })

    it('should say that the second factor was changed elsewhere when the code is sent, and begin anew', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      await toTheApp(user)
      const code = await testApi().authenticatorCode(shownSecret())
      // An operator resets the second factor meanwhile
      await turnOffElsewhere()

      // Act
      await typeAppCode(user, code)

      // Assert
      expect(
        await screen.findByRole('heading', { name: 'パスワードを確かめる' }),
      ).toHaveFocus()
      expect(notifications()).toContain(CHANGED_ELSEWHERE)
      expect(screen.getByLabelText('パスワード')).toHaveValue('')
      expect(await twoFactorOf(CUSTOMER)).toMatchObject({ status: 'disabled' })
    })

    it('should say that nothing came of it, and change nothing, when the database refuses the set-up', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      renderSetup()
      const password = await screen.findByLabelText('パスワード')
      await refuse('update', 'users')

      // Act
      await user.type(password, testApi().seedPassword)
      await user.click(screen.getByRole('button', { name: '設定を始める' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_SENT)
      expect(password).not.toHaveValue('')
      expect(await twoFactorOf(CUSTOMER)).toMatchObject({ status: 'disabled' })
    })
  })

  describe('the second factor on the screen of the security of the account', () => {
    it('should lead an account without it to the screen that sets it up', async () => {
      // Arrange
      await signInAs(CUSTOMER)

      // Act
      renderSecurity()

      // Assert
      expect(
        await within(
          await screen.findByRole('region', { name: '2 要素認証' }),
        ).findByRole('link', { name: '2 要素認証を設定する' }),
      ).toHaveAttribute('href', '/account/security/two-factor')
    })

    it('should lead an account left half way to the screen that sets it up again', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      expect(
        (await authCrudEnableTwoFactor({ password: testApi().seedPassword }))
          .status,
      ).toBe(200)

      // Act
      renderSecurity()

      // Assert
      expect(
        await within(
          await screen.findByRole('region', { name: '2 要素認証' }),
        ).findByRole('link', { name: '設定をやり直す' }),
      ).toHaveAttribute('href', '/account/security/two-factor')
    })

    it('should issue new backup codes after a code of the app, show them in the dialog, and leave the codes of before of no use', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const setup = await enableThroughApi()
      const user = userEvent.setup()
      renderSecurity()
      const issue = await screen.findByRole('button', {
        name: 'バックアップコードを発行し直す',
      })
      await user.click(issue)
      const dialog = screen.getByRole('dialog', {
        name: 'バックアップコードを発行し直す',
      })

      // Act: the code of the next 30 seconds; that of these was used
      await user.type(
        within(dialog).getByLabelText('認証アプリのコードかバックアップコード'),
        await testApi().authenticatorCode(setup.secret, 1),
      )
      await user.click(
        within(dialog).getByRole('button', { name: '発行し直す' }),
      )

      // Assert
      // The focus is on the answer, which took the place of the form
      const said =
        await within(dialog).findByText(/^新しいバックアップコードです。/)
      expect(said.parentElement).toHaveFocus()
      const issued = within(dialog)
        .getAllByRole('code')
        .map((code) => code.textContent ?? '')
      expect(issued).toHaveLength(10)
      expect(issued.some((code) => setup.backupCodes.includes(code))).toBe(
        false,
      )
      expect(await subjectsTo(CUSTOMER)).toEqual([
        '2 要素認証が有効になりました',
        'バックアップコードが再発行されました',
      ])
      expect(await signInWithBackupCode(setup.backupCodes[0] ?? '')).toBe(401)
      expect(await signInWithBackupCode(issued[0] ?? '')).toBe(200)
      // Closed, the dialog closes: that the browser gives the focus back to the button is in the browser tests
      await user.click(within(dialog).getByRole('button', { name: '閉じる' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(issue).toBeVisible()
    })

    it('should issue new backup codes after a backup code, and say at the code when it was used before', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const setup = await enableThroughApi()
      const [used, unused] = setup.backupCodes
      expect(await signInWithBackupCode(used ?? '')).toBe(200)
      const user = userEvent.setup()
      renderSecurity()
      await user.click(
        await screen.findByRole('button', {
          name: 'バックアップコードを発行し直す',
        }),
      )
      const dialog = screen.getByRole('dialog', {
        name: 'バックアップコードを発行し直す',
      })
      const code = within(dialog).getByLabelText(
        '認証アプリのコードかバックアップコード',
      )

      // Act: a backup code that was used, then one in small letters
      await user.type(code, used ?? '')
      await user.click(
        within(dialog).getByRole('button', { name: '発行し直す' }),
      )
      await waitFor(() => expect(code).toBeInvalid())
      expect(code).toHaveAccessibleDescription(
        expect.stringContaining(
          `コードが違うか、使ったことのあるバックアップコードです。${LOCK}`,
        ),
      )
      await user.clear(code)
      await user.type(code, (unused ?? '').toLowerCase())
      await user.click(
        within(dialog).getByRole('button', { name: '発行し直す' }),
      )

      // Assert
      expect(
        (await within(dialog).findByText(/^新しいバックアップコードです。/))
          .parentElement,
      ).toHaveFocus()
      // The used code counted as a wrong attempt, until a sign-in succeeds
      expect(await twoFactorOf(CUSTOMER)).toEqual({
        status: 'enabled',
        failedAttempts: 1,
        backupCodes: 10,
      })
    })

    it('should turn the second factor off after the password and a backup code, say so, and offer to set it up again', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const setup = await enableThroughApi()
      const user = userEvent.setup()
      renderSecurity()
      await user.click(
        await screen.findByRole('button', { name: '2 要素認証を無効にする' }),
      )
      const dialog = screen.getByRole('dialog', {
        name: '2 要素認証を無効にしますか？',
      })

      // Act
      await user.type(
        within(dialog).getByLabelText('パスワード'),
        testApi().seedPassword,
      )
      await user.type(
        within(dialog).getByLabelText('認証アプリのコードかバックアップコード'),
        setup.backupCodes[0] ?? '',
      )
      await user.click(
        within(dialog).getByRole('button', { name: '無効にする' }),
      )

      // Assert: off in the commit that closes the dialog, before the account is read again
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      const part = region('2 要素認証')
      expect(within(part).getByText('未設定')).toBeVisible()
      expect(
        within(part).getByRole('link', { name: '2 要素認証を設定する' }),
      ).toBeVisible()
      expect(heading('2 要素認証')).toHaveFocus()
      expect(notifications()).toContain(
        '2 要素認証を無効にしました。サインインのときに確かめるのは、パスワードだけになりました。無効にしたことを、メールでお知らせしました。',
      )
      expect(await twoFactorOf(CUSTOMER)).toEqual({
        status: 'disabled',
        failedAttempts: 0,
        backupCodes: 0,
      })
      expect(await subjectsTo(CUSTOMER)).toEqual([
        '2 要素認証が有効になりました',
        '2 要素認証が無効になりました',
      ])
    })

    it('should say at the password that it is wrong, and then at the code, keeping the second factor on', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const setup = await enableThroughApi()
      const user = userEvent.setup()
      renderSecurity()
      await user.click(
        await screen.findByRole('button', { name: '2 要素認証を無効にする' }),
      )
      const dialog = screen.getByRole('dialog', {
        name: '2 要素認証を無効にしますか？',
      })
      const password = within(dialog).getByLabelText('パスワード')
      const code = within(dialog).getByLabelText(
        '認証アプリのコードかバックアップコード',
      )
      const [first] = setup.backupCodes
      expect(await signInWithBackupCode(first ?? '')).toBe(200)

      // Act: a wrong password, then the right one with a used backup code
      await user.type(password, 'kirei na kami de dekakeru')
      await user.type(code, first ?? '')
      await user.click(
        within(dialog).getByRole('button', { name: '無効にする' }),
      )
      await waitFor(() => expect(password).toBeInvalid())
      expect(password).toHaveAccessibleDescription(
        `パスワードが違います。${LOCK}`,
      )
      // The API reads the code only after the password
      expect(code).not.toBeInvalid()
      await user.clear(password)
      await user.type(password, testApi().seedPassword)
      await user.click(
        within(dialog).getByRole('button', { name: '無効にする' }),
      )

      // Assert
      await waitFor(() => expect(code).toBeInvalid())
      expect(code).toHaveAccessibleDescription(
        expect.stringContaining(
          `コードが違うか、使ったことのあるバックアップコードです。${LOCK}`,
        ),
      )
      expect(password).not.toBeInvalid()
      expect(await twoFactorOf(CUSTOMER)).toEqual({
        status: 'enabled',
        failedAttempts: 2,
        backupCodes: 9,
      })
    })

    it('should close the dialog and show the state of now when the second factor was turned off elsewhere', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const setup = await enableThroughApi()
      const user = userEvent.setup()
      renderSecurity()
      await user.click(
        await screen.findByRole('button', {
          name: 'バックアップコードを発行し直す',
        }),
      )
      const dialog = screen.getByRole('dialog', {
        name: 'バックアップコードを発行し直す',
      })
      // Another device turns the second factor off meanwhile
      await turnOffElsewhere()

      // Act
      await user.type(
        within(dialog).getByLabelText('認証アプリのコードかバックアップコード'),
        setup.backupCodes[0] ?? '',
      )
      await user.click(
        within(dialog).getByRole('button', { name: '発行し直す' }),
      )

      // Assert
      const part = region('2 要素認証')
      expect(
        await within(part).findByRole('link', { name: '2 要素認証を設定する' }),
      ).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(heading('2 要素認証')).toHaveFocus()
      expect(notifications()).toContain(CHANGED_ELSEWHERE)
    })

    it('should say in the dialog that nothing came of it, and keep the backup codes, when the database refuses the new ones', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const setup = await enableThroughApi()
      const user = userEvent.setup()
      renderSecurity()
      await user.click(
        await screen.findByRole('button', {
          name: 'バックアップコードを発行し直す',
        }),
      )
      const dialog = screen.getByRole('dialog', {
        name: 'バックアップコードを発行し直す',
      })
      const code = within(dialog).getByLabelText(
        '認証アプリのコードかバックアップコード',
      )
      await refuse('update', 'users')

      // Act
      await user.type(code, setup.backupCodes[0] ?? '')
      await user.click(
        within(dialog).getByRole('button', { name: '発行し直す' }),
      )

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        NOT_SENT,
      )
      expect(code).toHaveValue(setup.backupCodes[0])
      expect(await twoFactorOf(CUSTOMER)).toEqual({
        status: 'enabled',
        failedAttempts: 0,
        backupCodes: 10,
      })
    })
  })
})
