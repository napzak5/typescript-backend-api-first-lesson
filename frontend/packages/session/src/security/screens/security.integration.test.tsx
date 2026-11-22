import {
  authCrudEnableTwoFactor,
  authCrudLogin,
  authCrudVerifyTwoFactor,
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
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AccountSecurityScreen,
  PasswordChangeScreen,
  RequireSession,
  SessionAccount,
  signIn,
} from '../..'
import { momentOf } from '../utils/security-format'

const NEW_PASSWORD = 'aoi sora to shiroi kumo no aida'
const GUESSABLE = 'password1234567890'
const WRONG_CURRENT =
  '現在のパスワードが違います。5 回続けて違うと、15 分間、サインインもできなくなります。'

const NOT_SENT =
  '送信できませんでした。通信の状態を確かめて、もう一度お試しください。'

/** The time zone the screens say a moment in: that of the browser */
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

/** An application with somebody signed in, whose one screen is `screen`. */
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

/** Signs the account in elsewhere, through the API: another device. */
const signInElsewhere = async (email: string): Promise<void> => {
  const signedIn = await authCrudLogin({
    email,
    password: testApi().seedPassword,
    rememberMe: true,
    twoFactorCode: null,
  })
  expect(signedIn.status).toBe(200)
}

type SessionRow = {
  id: string
  ipAddress: string | null
  userAgent: string | null
  lastActivityAt: string
  refreshExpiresAt: string
  createdAt: string
}

/** The sessions of an account, as the database of the API has them, the latest first. */
const sessionsOf = async (email: string): Promise<SessionRow[]> => {
  const rows = await testApi().query(
    `select s.id, s."ipAddress", s."userAgent",
            to_json(s."lastActivityAt") #>> '{}' as "lastActivityAt",
            to_json(s."refreshExpiresAt") #>> '{}' as "refreshExpiresAt",
            to_json(s."createdAt") #>> '{}' as "createdAt"
       from sessions s join users u on u.id = s."userId"
      where u.email = $1
      order by s."createdAt" desc, s.id desc`,
    [email],
  )

  return rows.map((row) => ({
    id: String(row['id']),
    ipAddress: row['ipAddress'] === null ? null : String(row['ipAddress']),
    userAgent: row['userAgent'] === null ? null : String(row['userAgent']),
    lastActivityAt: String(row['lastActivityAt']),
    refreshExpiresAt: String(row['refreshExpiresAt']),
    createdAt: String(row['createdAt']),
  }))
}

/**
 * Gives the account sessions of devices that signed in over the last days,
 * one an hour, as the API would have made them.
 */
const addSessions = async (email: string, count: number): Promise<void> => {
  await testApi().query(
    `insert into sessions ("userId", "tokenHash", "refreshTokenHash", "ipAddress", "userAgent",
                           "expiresAt", "refreshExpiresAt", "lastActivityAt", "createdAt")
     select u.id, gen_random_uuid()::text, gen_random_uuid()::text, '192.0.2.' || n,
            'Example Browser ' || n, now() - interval '1 hour', now() + interval '20 days',
            now() - n * interval '1 hour', now() - n * interval '1 hour'
       from users u, generate_series(1, $2::int) n
      where u.email = $1`,
    [email, count],
  )
}

/** What the database keeps of the password of an account. */
const passwordOf = async (email: string) => {
  const [row] = await testApi().query(
    `select "passwordHash" as hash, to_json("lastPasswordChange") #>> '{}' as "changedAt",
            "failedLoginAttempts" as "failedAttempts"
       from users where email = $1`,
    [email],
  )

  return row
}

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

const devices = (): HTMLElement[] =>
  within(
    screen.getByRole('list', { name: 'サインインしている端末' }),
  ).getAllByRole('listitem')

const devicesPart = () =>
  screen.getByRole('region', { name: 'サインインしている端末' })

/**
 * Waits for the list, and for the count above it to say `count` and nothing
 * more: the count of a list that shows part of it begins with the count of
 * the whole list.
 */
const listed = async (count: string): Promise<void> => {
  await waitFor(() =>
    expect(within(devicesPart()).getByRole('status').textContent).toBe(count),
  )
}

/** What the application says in its notifications: the statuses but the count of the devices. */
const notifications = () => {
  const part = screen.queryByRole('region', { name: 'サインインしている端末' })

  return screen
    .getAllByRole('status')
    .filter((region) => part === null || !part.contains(region))
    .map((region) => region.textContent)
    .filter((text) => text !== '')
}

describe('the security of an account, against the API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('the screen of the security of the account', () => {
    it('should show the password, the second factor and this device as the database has them', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const [session] = await sessionsOf(CUSTOMER)
      const password = await passwordOf(CUSTOMER)

      // Act
      renderSecurity()
      await listed('1 台の端末でサインインしています')

      // Assert: the account and the devices are read apart, either may come first
      const passwordPart = await screen.findByRole('region', {
        name: 'パスワード',
      })
      // The seeded accounts have the passwords they were made with
      expect(password?.['changedAt']).toBeNull()
      expect(
        within(passwordPart).getByText(
          'アカウントを作ってから、変更していません',
        ),
      ).toBeVisible()
      expect(
        within(screen.getByRole('region', { name: '2 要素認証' })).getByText(
          '未設定',
        ),
      ).toBeVisible()
      const [device] = devices()
      expect(device).toBeDefined()
      expect(session).toBeDefined()
      if (device === undefined || session === undefined) {
        return
      }
      expect(
        within(device).getByRole('heading', { level: 3 }),
      ).toHaveTextContent(
        `${momentOf(session.createdAt, TIME_ZONE)} にサインインした端末`,
      )
      expect(within(device).getByText('この端末')).toBeVisible()
      expect(
        within(device)
          .getAllByRole('definition')
          .map((value) => value.textContent),
      ).toEqual([
        session.userAgent ?? '記録されていません',
        session.ipAddress ?? '記録されていません',
        momentOf(session.lastActivityAt, TIME_ZONE),
        momentOf(session.refreshExpiresAt, TIME_ZONE),
      ])
      expect(within(device).queryByRole('button')).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should say when the password was changed last', async () => {
      // Arrange
      await testApi().query(
        `update users set "lastPasswordChange" = '2026-10-02T09:30:00Z' where email = $1`,
        [CUSTOMER],
      )
      await signInAs(CUSTOMER)

      // Act
      renderSecurity()

      // Assert
      expect(
        await within(
          await screen.findByRole('region', { name: 'パスワード' }),
        ).findByText(momentOf('2026-10-02T09:30:00.000Z', TIME_ZONE)),
      ).toBeVisible()
    })

    it.each([
      ['set up and not confirmed', false, '設定の途中'],
      ['confirmed with a code', true, '有効'],
    ])(
      'should say that the second factor is %s',
      async (_case, confirm, state) => {
        // Arrange
        await signInAs(CUSTOMER)
        const setUp = await authCrudEnableTwoFactor({
          password: testApi().seedPassword,
        })
        expect(setUp.status).toBe(200)
        if (confirm && setUp.status === 200) {
          const confirmed = await authCrudVerifyTwoFactor({
            code: await testApi().authenticatorCode(setUp.data.data.secret),
          })
          expect(confirmed.status).toBe(204)
        }

        // Act
        renderSecurity()

        // Assert
        expect(
          await within(
            await screen.findByRole('region', { name: '2 要素認証' }),
          ).findByText(state),
        ).toBeVisible()
      },
    )
  })

  describe('the devices that are signed in', () => {
    it('should list another device beside this one, the latest first, and offer to sign out the other alone', async () => {
      // Arrange
      await signInElsewhere(CUSTOMER)
      await signInAs(CUSTOMER)
      const [mine, other] = await sessionsOf(CUSTOMER)

      // Act
      renderSecurity()
      await listed('2 台の端末でサインインしています')

      // Assert
      const [first, second] = devices()
      expect(first).toBeDefined()
      expect(second).toBeDefined()
      if (
        first === undefined ||
        second === undefined ||
        mine === undefined ||
        other === undefined
      ) {
        return
      }
      expect(within(first).getByText('この端末')).toBeVisible()
      expect(within(first).queryByRole('button')).toBeNull()
      expect(within(second).queryByText('この端末')).toBeNull()
      expect(
        within(second).getByRole('button', { name: /をサインアウトさせる$/ }),
      ).toHaveAccessibleName(
        `${momentOf(other.createdAt, TIME_ZONE)} にサインインした端末をサインアウトさせる`,
      )
    })

    it('should sign the other device out, take its row away, and give the focus to the heading of the devices', async () => {
      // Arrange
      await signInElsewhere(CUSTOMER)
      await signInAs(CUSTOMER)
      const [mine] = await sessionsOf(CUSTOMER)
      const user = userEvent.setup()
      renderSecurity()
      await listed('2 台の端末でサインインしています')

      // Act
      await user.click(
        within(devicesPart()).getByRole('button', {
          name: /をサインアウトさせる$/,
        }),
      )
      await listed('1 台の端末でサインインしています')

      // Assert
      expect(await sessionsOf(CUSTOMER)).toEqual([mine])
      expect(devices()).toHaveLength(1)
      expect(
        within(devicesPart()).getByRole('heading', {
          level: 2,
          name: 'サインインしている端末',
        }),
      ).toHaveFocus()
      expect(notifications()).toEqual([
        '端末をサインアウトさせました。その端末で使うには、もう一度サインインが必要です。',
      ])
    })

    it('should take the row away all the same when the device was signed out elsewhere in the meantime', async () => {
      // Arrange
      await signInElsewhere(CUSTOMER)
      await signInAs(CUSTOMER)
      const [mine, other] = await sessionsOf(CUSTOMER)
      const user = userEvent.setup()
      renderSecurity()
      await listed('2 台の端末でサインインしています')
      await testApi().query('delete from sessions where id = $1', [
        other?.id ?? null,
      ])

      // Act
      await user.click(
        within(devicesPart()).getByRole('button', {
          name: /をサインアウトさせる$/,
        }),
      )
      await listed('1 台の端末でサインインしています')

      // Assert
      expect(await sessionsOf(CUSTOMER)).toEqual([mine])
      expect(
        within(devicesPart()).getByRole('heading', { level: 2 }),
      ).toHaveFocus()
    })

    it('should keep the row, and say that nothing came of it, when the device could not be signed out', async () => {
      // Arrange
      await signInElsewhere(CUSTOMER)
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      renderSecurity()
      await listed('2 台の端末でサインインしています')
      await refuse('delete', 'sessions')
      const button = within(devicesPart()).getByRole('button', {
        name: /をサインアウトさせる$/,
      })

      // Act
      await user.click(button)

      // Assert
      await waitFor(() => expect(notifications()).toEqual([NOT_SENT]))
      expect(devices()).toHaveLength(2)
      expect(button).toHaveFocus()
      expect(button).not.toHaveAttribute('aria-busy')
      expect(await sessionsOf(CUSTOMER)).toHaveLength(2)
    })

    it('should fill a full page again from the devices after it when one of them was signed out', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      await addSessions(CUSTOMER, 20)
      const [, ended] = await sessionsOf(CUSTOMER)
      const user = userEvent.setup()
      renderSecurity()
      await listed('21 台の端末でサインインしています（20 台を表示しています）')

      // Act: the first device that is not this one
      const second = devices().at(1)
      expect(second).toBeDefined()
      if (second === undefined) {
        return
      }
      await user.click(
        within(second).getByRole('button', { name: /をサインアウトさせる$/ }),
      )
      await listed('20 台の端末でサインインしています')

      // Assert: the row went at once, with the focus on the heading, and
      // the page was read again behind it, with the 21st device
      expect(
        within(devicesPart()).getByRole('heading', { level: 2 }),
      ).toHaveFocus()
      await waitFor(() => expect(devices()).toHaveLength(20))
      expect(
        within(devicesPart()).queryByRole('button', { name: 'さらに表示' }),
      ).toBeNull()
      const left = (await sessionsOf(CUSTOMER)).map(({ id }) => id)
      expect(left).toHaveLength(20)
      expect(left).not.toContain(ended?.id)
    })

    it('should list 20 devices, and the 21st when more are asked for, with the focus on it', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      await addSessions(CUSTOMER, 20)
      const last = (await sessionsOf(CUSTOMER)).at(-1)
      const user = userEvent.setup()
      renderSecurity()
      await listed('21 台の端末でサインインしています（20 台を表示しています）')

      // Act
      await user.click(
        within(devicesPart()).getByRole('button', { name: 'さらに表示' }),
      )
      await listed('21 台の端末でサインインしています')

      // Assert
      expect(devices()).toHaveLength(21)
      const added = devices().at(20)
      expect(added).toBeDefined()
      if (added === undefined || last === undefined) {
        return
      }
      // The device takes the focus, and is read from its name
      expect(added).toHaveFocus()
      expect(within(added).getByText(last.ipAddress ?? '')).toBeVisible()
      expect(
        within(devicesPart()).queryByRole('button', { name: 'さらに表示' }),
      ).toBeNull()
    })

    it('should read the list again from its start when the device the next page begins after has signed out', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      await addSessions(CUSTOMER, 20)
      const sessions = await sessionsOf(CUSTOMER)
      const user = userEvent.setup()
      renderSecurity()
      await listed('21 台の端末でサインインしています（20 台を表示しています）')
      // The last device of the first page signs out on its own
      await testApi().query('delete from sessions where id = $1', [
        sessions.at(19)?.id ?? null,
      ])

      // Act
      await user.click(
        within(devicesPart()).getByRole('button', { name: 'さらに表示' }),
      )
      await listed('20 台の端末でサインインしています')

      // Assert
      expect(devices()).toHaveLength(20)
      expect(
        within(devicesPart()).queryByRole('button', {
          name: /さらに表示|もう一度読み込む/,
        }),
      ).toBeNull()
      expect(within(devicesPart()).queryByRole('alert')).toBeNull()
    })

    it('should sign out every device, this one too, after it asked, and show the sign-in screen', async () => {
      // Arrange
      await signInElsewhere(CUSTOMER)
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      renderSecurity()
      await listed('2 台の端末でサインインしています')
      await user.click(
        screen.getByRole('button', { name: 'すべての端末でサインアウトする' }),
      )
      const dialog = screen.getByRole('dialog', {
        name: 'すべての端末でサインアウトしますか？',
      })

      // Act
      await user.click(
        within(dialog).getByRole('button', { name: 'サインアウトする' }),
      )

      // Assert
      expect(
        await screen.findByRole('heading', { level: 1, name: 'サインイン' }),
      ).toBeVisible()
      expect(await sessionsOf(CUSTOMER)).toEqual([])
      expect(localStorage.length).toBe(0)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(notifications()).toContain('すべての端末でサインアウトしました。')
    })

    it('should say in the dialog that nothing came of it, and keep every device signed in, when the devices could not be signed out', async () => {
      // Arrange
      await signInElsewhere(CUSTOMER)
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      renderSecurity()
      await listed('2 台の端末でサインインしています')
      await refuse('delete', 'sessions')
      await user.click(
        screen.getByRole('button', { name: 'すべての端末でサインアウトする' }),
      )
      const dialog = screen.getByRole('dialog', {
        name: 'すべての端末でサインアウトしますか？',
      })

      // Act
      await user.click(
        within(dialog).getByRole('button', { name: 'サインアウトする' }),
      )

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        NOT_SENT,
      )
      expect(dialog).toBeVisible()
      expect(await sessionsOf(CUSTOMER)).toHaveLength(2)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'アカウントの安全',
      )
      expect(localStorage.length).toBeGreaterThan(0)
    })

    it('should sign out nothing when the dialog is left', async () => {
      // Arrange
      await signInElsewhere(CUSTOMER)
      await signInAs(CUSTOMER)
      const user = userEvent.setup()
      renderSecurity()
      await listed('2 台の端末でサインインしています')
      await user.click(
        screen.getByRole('button', { name: 'すべての端末でサインアウトする' }),
      )

      // Act
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: '戻る',
        }),
      )

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await sessionsOf(CUSTOMER)).toHaveLength(2)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'アカウントの安全',
      )
    })
  })

  describe('changing the password', () => {
    const renderChange = () => {
      const onChanged = vi.fn()
      renderApplication(
        <PasswordChangeScreen
          securityHref='/account/security'
          onChanged={onChanged}
        />,
      )

      return onChanged
    }

    const enter = async (current: string, chosen: string): Promise<void> => {
      const user = userEvent.setup()
      await user.type(await screen.findByLabelText('現在のパスワード'), current)
      await user.type(screen.getByLabelText('新しいパスワード'), chosen)
      await user.click(
        screen.getByRole('button', { name: 'パスワードを変更する' }),
      )
    }

    it('should change the password, sign out every other device, keep this one and mail the account', async () => {
      // Arrange
      await signInElsewhere(CUSTOMER)
      await signInAs(CUSTOMER)
      const [mine] = await sessionsOf(CUSTOMER)
      const before = await passwordOf(CUSTOMER)
      const onChanged = renderChange()

      // Act
      await enter(testApi().seedPassword, NEW_PASSWORD)

      // Assert
      await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
      const after = await passwordOf(CUSTOMER)
      expect(after?.['hash']).not.toBe(before?.['hash'])
      expect(after?.['changedAt']).not.toBeNull()
      expect(await sessionsOf(CUSTOMER)).toEqual([mine])
      expect(
        (await testApi().mails()).map(({ to, subject }) => ({ to, subject })),
      ).toEqual([{ to: CUSTOMER, subject: 'パスワードが変更されました' }])
      expect(notifications()).toEqual([
        'パスワードを変更しました。この端末のほかは、すべての端末でサインアウトしました。変更したことを、メールでお知らせしました。',
      ])
      const signedInAgain = await signIn({
        email: CUSTOMER,
        password: NEW_PASSWORD,
        rememberMe: false,
        twoFactorCode: null,
      })
      expect(signedInAgain).toEqual({ type: 'signedIn' })
    })

    it('should say at the current password that it is wrong, keep what was typed and change nothing', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const before = await passwordOf(CUSTOMER)
      const onChanged = renderChange()

      // Act
      await enter('not the password of the account', NEW_PASSWORD)

      // Assert
      const current = screen.getByLabelText('現在のパスワード')
      await waitFor(() =>
        expect(current).toHaveAccessibleDescription(WRONG_CURRENT),
      )
      expect(current).toHaveFocus()
      expect(current).toHaveValue('not the password of the account')
      expect(screen.getByLabelText('新しいパスワード')).toHaveValue(
        NEW_PASSWORD,
      )
      expect(onChanged).not.toHaveBeenCalled()
      const after = await passwordOf(CUSTOMER)
      expect(after?.['hash']).toBe(before?.['hash'])
      // The wrong password counts towards the lock of the account
      expect(after?.['failedAttempts']).toBe(
        Number(before?.['failedAttempts']) + 1,
      )
    })

    it('should say at the new password that it is easy to guess, and change nothing', async () => {
      // Arrange
      await signInAs(CUSTOMER)
      const before = await passwordOf(CUSTOMER)
      const onChanged = renderChange()

      // Act
      await enter(testApi().seedPassword, GUESSABLE)

      // Assert
      const chosen = screen.getByLabelText('新しいパスワード')
      await waitFor(() =>
        expect(chosen).toHaveAccessibleDescription(
          expect.stringContaining(
            'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。',
          ),
        ),
      )
      expect(chosen).toHaveFocus()
      expect(onChanged).not.toHaveBeenCalled()
      expect((await passwordOf(CUSTOMER))?.['hash']).toBe(before?.['hash'])
      expect(await testApi().mails()).toEqual([])
    })

    it('should say that nothing came of it, keep what was typed and change nothing, when the password could not be stored', async () => {
      // Arrange
      await signInElsewhere(CUSTOMER)
      await signInAs(CUSTOMER)
      const before = await passwordOf(CUSTOMER)
      await refuse('update of "passwordHash"', 'users')
      const onChanged = renderChange()

      // Act
      await enter(testApi().seedPassword, NEW_PASSWORD)

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_SENT)
      // What was typed stays (the current password is not named: a failure would print it)
      expect(screen.getByLabelText('現在のパスワード')).not.toHaveValue('')
      expect(screen.getByLabelText('新しいパスワード')).toHaveValue(
        NEW_PASSWORD,
      )
      expect(onChanged).not.toHaveBeenCalled()
      expect((await passwordOf(CUSTOMER))?.['hash']).toBe(before?.['hash'])
      expect(await sessionsOf(CUSTOMER)).toHaveLength(2)
      expect(await testApi().mails()).toEqual([])
    })

    it.each([
      [
        'a new password that is too short',
        'short',
        'パスワードが短すぎます。15 文字以上で入力してください。',
      ],
      [
        'the current password again',
        null,
        '現在のパスワードと同じです。別のパスワードを入力してください。',
      ],
    ])(
      'should send nothing for %s, and say so at the new password',
      async (_case, chosen, said) => {
        // Arrange
        await signInAs(CUSTOMER)
        const fetched = vi.spyOn(globalThis, 'fetch')
        const onChanged = renderChange()
        await screen.findByLabelText('現在のパスワード')
        fetched.mockClear()

        // Act
        await enter(testApi().seedPassword, chosen ?? testApi().seedPassword)

        // Assert
        const field = screen.getByLabelText('新しいパスワード')
        expect(field).toHaveAccessibleDescription(expect.stringContaining(said))
        expect(field).toHaveFocus()
        expect(fetched).not.toHaveBeenCalled()
        expect(onChanged).not.toHaveBeenCalled()
      },
    )
  })
})
