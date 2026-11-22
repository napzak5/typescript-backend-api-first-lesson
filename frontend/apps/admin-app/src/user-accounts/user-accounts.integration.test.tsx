import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf, testApi } from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  goBack,
  goTo,
  heading,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../__tests__/screens'
import { refuse } from '../bookings/__tests__/arrangements'
import { customerIdOf } from '../customers/__tests__/arrangements'
import {
  customerHrefOf,
  staffAccountHrefOf,
  userAccountHrefOf,
} from '../navigation'
import { staffIdOf, TANAKA } from '../staff/__tests__/arrangements'
import {
  arrangeLock,
  arrangeNoAccount,
  arrangeTwoFactor,
  deletedMeanwhile,
  lockedUntilOf,
  storedAccountOf,
  twoFactorOffMeanwhile,
  unlockedMeanwhile,
  userIdOf,
} from './__tests__/arrangements'
import {
  ADMINISTRATORS_ONLY,
  lockNameOf,
  NOTHING_TO_DO,
  OWN_ACCOUNT,
} from './user-accounts'

/*
 * The accounts of the users against the API: an administrator is led to
 * one from a customer of the ledger and from a member of the staff, lifts
 * its lock, and resets its second factor, which the API mails the user
 * about. The accounts of the seed data are neither locked nor set up with
 * two factors; `__tests__/arrangements.ts` makes them so.
 */

/** Opens the account of an address as the administrator, and waits for its record. */
const openAccountOf = async (email: string): Promise<void> => {
  await openAs(userAccountHrefOf(await userIdOf(email)), OPERATOR)
  await screen.findByRole('region', { name: 'アカウントの状態' })
}

/** Each term of the record of the account with its description */
const detailsOf = (): string[][] => {
  const record = screen.getByRole('region', { name: 'アカウントの状態' })
  const descriptions = within(record).getAllByRole('definition')

  return within(record)
    .getAllByRole('term')
    .map((term, index) => [
      term.textContent ?? '',
      descriptions[index]?.textContent ?? '',
    ])
}

/** The heading of the record of the account */
const recordHeading = () =>
  within(screen.getByRole('region', { name: 'アカウントの状態' })).getByRole(
    'heading',
    { name: 'アカウントの状態' },
  )

/** The mails the API sent in this test, as their addresses and subjects. */
const mailed = async (): Promise<[string, string][]> =>
  (await testApi().mails()).map(({ to, subject }) => [to, subject])

const RESET_MAIL = '2 要素認証が管理者によって無効にされました'

/** The time zone of the device the tests run on, which the screen shows its moments in */
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

/** Opens the dialog of the reset of the second factor of the account of the address. */
const askToReset = async (
  user: ReturnType<typeof userEvent.setup>,
  email: string,
) => {
  await user.click(
    await screen.findByRole('button', { name: '2 要素認証をリセットする' }),
  )

  return screen.findByRole('dialog', {
    name: `${email} の 2 要素認証をリセットしますか？`,
  })
}

describe('the accounts of the users, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('the way to an account', () => {
    it('should lead an administrator from a customer of the ledger to the account they sign in with', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAs(
        customerHrefOf(await salonIdOf(TOKYO), await customerIdOf(YUKI.email)),
        OPERATOR,
      )
      const part = await screen.findByRole('region', {
        name: 'ログインアカウント',
      })
      expect(part).toHaveTextContent(
        'このお客様は、ポータルにログインするアカウントを持っています。ロックの解除と 2 要素認証のリセットは、アカウントの画面で行います。',
      )

      // Act
      await user.click(
        within(part).getByRole('link', { name: 'アカウントの状態を見る' }),
      )

      // Assert
      expect(await heading('ログインアカウント')).toBeVisible()
      await screen.findByRole('region', { name: 'アカウントの状態' })
      expect(firstSight()[0]).toBe(
        userAccountHrefOf(await userIdOf(YUKI.email)),
      )
      expect(screen.getByRole('main')).toHaveTextContent(YUKI.email)
      expect(detailsOf()).toEqual(
        expect.arrayContaining([
          ['メールアドレス', YUKI.email],
          ['ロール', 'お客様'],
          ['状態', '有効'],
          ['メールアドレスの確認', '確認済み'],
          ['ロック', 'ロックされていません'],
          ['パスワードの誤り', 'ありません'],
          ['2 要素認証', '設定していません'],
          ['紐づいている台帳', 'お客様の台帳'],
        ]),
      )
      expect(screen.getByText(NOTHING_TO_DO)).toBeVisible()
      expect(screen.queryByRole('region', { name: 'ロックの解除' })).toBeNull()
      expect(
        screen.queryByRole('region', { name: '2 要素認証のリセット' }),
      ).toBeNull()
    })

    it('should say of a customer whom a salon registered that they have no account', async () => {
      // Arrange
      await arrangeNoAccount(YUKI.email)

      // Act
      await openAs(
        customerHrefOf(await salonIdOf(TOKYO), await customerIdOf(YUKI.email)),
        OPERATOR,
      )

      // Assert
      const part = await screen.findByRole('region', {
        name: 'ログインアカウント',
      })
      expect(part).toHaveTextContent(
        'このお客様は、ポータルのアカウントを持っていません。',
      )
      expect(within(part).queryByRole('link')).toBeNull()
    })

    it('should lead an administrator from the account of a member of the staff to it', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAs(
        staffAccountHrefOf(await salonIdOf(TOKYO), await staffIdOf(TANAKA)),
        OPERATOR,
      )
      const record = await screen.findByRole('region', {
        name: 'ログインアカウント',
      })

      // Act
      await user.click(
        within(record).getByRole('link', { name: 'アカウントの状態を見る' }),
      )

      // Assert
      await screen.findByRole('region', { name: 'アカウントの状態' })
      expect(detailsOf()).toEqual(
        expect.arrayContaining([
          ['メールアドレス', STYLIST],
          ['ロール', 'スタッフ'],
          ['紐づいている台帳', 'スタッフ台帳'],
        ]),
      )
    })

    it('should lead an owner neither from a customer nor from a member of the staff to an account', async () => {
      // Arrange
      const salonId = await salonIdOf(TOKYO)
      await openAs(
        customerHrefOf(salonId, await customerIdOf(YUKI.email)),
        OWNER,
      )
      await screen.findByRole('region', { name: 'このサロンでの利用' })

      // Assert
      expect(
        screen.queryByRole('region', { name: 'ログインアカウント' }),
      ).toBeNull()

      // Act
      goTo(staffAccountHrefOf(salonId, await staffIdOf(TANAKA)))

      // Assert
      const record = await screen.findByRole('region', {
        name: 'ログインアカウント',
      })
      expect(
        within(record).getByRole('button', { name: '紐づけを解除する' }),
      ).toBeVisible()
      expect(
        within(record).queryByRole('link', { name: 'アカウントの状態を見る' }),
      ).toBeNull()
    })

    it.each<[string]>([[OWNER], [MANAGER], [STYLIST]])(
      'should tell %s who looks after the accounts, without reading one',
      async (email) => {
        // Arrange
        const fetched = vi.spyOn(globalThis, 'fetch')

        // Act
        await openAs(userAccountHrefOf(await userIdOf(YUKI.email)), email)

        // Assert
        expect(await screen.findByText(ADMINISTRATORS_ONLY)).toBeVisible()
        expect(
          screen.getByRole('link', { name: 'トップへ戻る' }),
        ).toHaveAttribute('href', '/')
        expect(
          fetched.mock.calls.map(([asked]) => new Request(asked).url),
        ).not.toContainEqual(expect.stringContaining('/admin/auth'))
      },
    )

    it.each<[string, () => Promise<string>]>([
      [
        'an ID of no account',
        async () => userAccountHrefOf('00000000-0000-4000-8000-000000000000'),
      ],
      ['an address that names no ID', async () => userAccountHrefOf('none')],
      [
        'a deleted account',
        async () => {
          const path = userAccountHrefOf(await userIdOf(YUKI.email))
          await deletedMeanwhile(YUKI.email)
          return path
        },
      ],
    ])('should say that %s is not found', async (_, pathOf) => {
      // Act
      await openAs(await pathOf(), OPERATOR)

      // Assert
      expect(
        await screen.findByText(
          'このアカウントは見つかりません。削除されたか、アドレスが違います。',
        ),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: 'トップへ戻る' })).toBeVisible()
    })
  })

  describe('a lock', () => {
    it('should show until when the account is locked, lift the lock, and show the account as the API has it now', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeLock(YUKI.email)
      const until = await lockedUntilOf(YUKI.email)
      await openAccountOf(YUKI.email)
      expect(detailsOf()).toEqual(
        expect.arrayContaining([
          ['状態', 'ロック中'],
          ['ロック', lockNameOf({ type: 'locked', until }, timezone)],
          ['パスワードの誤り', '5 回続けて誤っています'],
        ]),
      )

      // Act
      await user.click(screen.getByRole('button', { name: 'ロックを解除する' }))

      // Assert
      expect(
        await screen.findByText(
          `${YUKI.email} のロックを解除しました。いまのパスワードで、すぐにログインできます。`,
        ),
      ).toBeVisible()
      expect(detailsOf()).toEqual(
        expect.arrayContaining([
          ['状態', '有効'],
          ['ロック', 'ロックされていません'],
          ['パスワードの誤り', 'ありません'],
        ]),
      )
      expect(screen.queryByRole('region', { name: 'ロックの解除' })).toBeNull()
      expect(screen.getByText(NOTHING_TO_DO)).toBeVisible()
      expect(recordHeading()).toHaveFocus()
      expect(await storedAccountOf(YUKI.email)).toEqual([
        expect.objectContaining({
          status: 'active',
          failedLoginAttempts: 0,
          locked: false,
        }),
      ])
    })

    it('should say that the lock went meanwhile, and show the account as it is', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeLock(YUKI.email)
      await openAccountOf(YUKI.email)
      await unlockedMeanwhile(YUKI.email)

      // Act
      await user.click(screen.getByRole('button', { name: 'ロックを解除する' }))

      // Assert
      const record = screen.getByRole('region', { name: 'アカウントの状態' })
      expect(await within(record).findByRole('status')).toHaveTextContent(
        'このアカウントのロックは、その間に解けていました。利用者がログインしたか、パスワードを再設定したか、ほかの管理者が解除しました。いまの状態を表示しています。',
      )
      await waitFor(() =>
        expect(
          screen.queryByRole('region', { name: 'ロックの解除' }),
        ).toBeNull(),
      )
      expect(detailsOf()).toEqual(
        expect.arrayContaining([['ロック', 'ロックされていません']]),
      )
      expect(recordHeading()).toHaveFocus()
    })

    it('should say that an account deleted meanwhile is not found', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeLock(YUKI.email)
      await openAccountOf(YUKI.email)
      await deletedMeanwhile(YUKI.email)

      // Act
      await user.click(screen.getByRole('button', { name: 'ロックを解除する' }))

      // Assert
      expect(
        await screen.findByText(
          'このアカウントは見つかりません。削除されたか、アドレスが違います。',
        ),
      ).toBeVisible()
      expect(
        screen.queryByRole('region', { name: 'アカウントの状態' }),
      ).toBeNull()
    })

    it('should say what went wrong when the lock could not be lifted, and keep it', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeLock(YUKI.email)
      await openAccountOf(YUKI.email)
      await refuse('update', 'users')

      // Act
      await user.click(screen.getByRole('button', { name: 'ロックを解除する' }))

      // Assert
      expect(
        await within(
          screen.getByRole('region', { name: 'ロックの解除' }),
        ).findByRole('alert'),
      ).toHaveTextContent(
        'ロックを解除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(await storedAccountOf(YUKI.email)).toEqual([
        expect.objectContaining({ status: 'locked', locked: true }),
      ])
    })
  })

  describe('a second factor', () => {
    it('should reset the second factor after the dialog, and have the API mail the user', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeTwoFactor(YUKI.email)
      await openAccountOf(YUKI.email)
      const dialog = await askToReset(user, YUKI.email)

      // Act
      await user.click(
        within(dialog).getByRole('button', { name: 'リセットする' }),
      )

      // Assert
      expect(
        await screen.findByText(
          `${YUKI.email} の 2 要素認証をリセットしました。パスワードだけでログインできます。利用者には、メールで知らせます。`,
        ),
      ).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(detailsOf()).toEqual(
        expect.arrayContaining([['2 要素認証', '設定していません']]),
      )
      expect(
        screen.queryByRole('region', { name: '2 要素認証のリセット' }),
      ).toBeNull()
      expect(recordHeading()).toHaveFocus()
      expect(await storedAccountOf(YUKI.email)).toEqual([
        expect.objectContaining({
          twoFactorStatus: 'disabled',
          secretKept: false,
          backupCodesKept: false,
        }),
      ])
      await waitFor(async () =>
        expect(await mailed()).toEqual([[YUKI.email, RESET_MAIL]]),
      )
    })

    it('should show the account of a member as it is after a reset, on the way back', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeTwoFactor(STYLIST)
      const staffAccount = staffAccountHrefOf(
        await salonIdOf(TOKYO),
        await staffIdOf(TANAKA),
      )
      await openAs(staffAccount, OPERATOR)
      const record = await screen.findByRole('region', {
        name: 'ログインアカウント',
      })
      expect(record).toHaveTextContent('2 要素認証設定しています')
      await user.click(
        within(record).getByRole('link', { name: 'アカウントの状態を見る' }),
      )
      const dialog = await askToReset(user, STYLIST)
      await user.click(
        within(dialog).getByRole('button', { name: 'リセットする' }),
      )
      await screen.findByText(
        `${STYLIST} の 2 要素認証をリセットしました。パスワードだけでログインできます。利用者には、メールで知らせます。`,
      )

      // Act
      goBack()

      // Assert
      expect(
        await screen.findByRole('region', { name: 'ログインアカウント' }),
      ).toHaveTextContent('2 要素認証設定していません')
      expect(firstSight()[0]).toBe(staffAccount)
      expect(firstSight()[1]).not.toContain('設定しています')
    })

    it('should say that the second factor went meanwhile, close the dialog, and mail nobody', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeTwoFactor(YUKI.email)
      await openAccountOf(YUKI.email)
      const dialog = await askToReset(user, YUKI.email)
      await twoFactorOffMeanwhile(YUKI.email)

      // Act
      await user.click(
        within(dialog).getByRole('button', { name: 'リセットする' }),
      )

      // Assert
      const record = screen.getByRole('region', { name: 'アカウントの状態' })
      expect(await within(record).findByRole('status')).toHaveTextContent(
        'このアカウントの 2 要素認証は、その間に有効でなくなっていました。利用者が無効にしたか、ほかの管理者がリセットしました。いまの状態を表示しています。',
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() =>
        expect(
          screen.queryByRole('region', { name: '2 要素認証のリセット' }),
        ).toBeNull(),
      )
      expect(recordHeading()).toHaveFocus()
      expect(await mailed()).toEqual([])
    })

    it('should say in the dialog what went wrong when the second factor could not be reset, and keep it', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeTwoFactor(YUKI.email)
      await openAccountOf(YUKI.email)
      const dialog = await askToReset(user, YUKI.email)
      await refuse('update', 'users')

      // Act
      await user.click(
        within(dialog).getByRole('button', { name: 'リセットする' }),
      )

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        '2 要素認証をリセットできませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(await storedAccountOf(YUKI.email)).toEqual([
        expect.objectContaining({
          twoFactorStatus: 'enabled',
          secretKept: true,
        }),
      ])
      expect(await mailed()).toEqual([])
    })
  })

  it('should offer an administrator neither on their own account', async () => {
    // Arrange
    await openAs('/', OPERATOR)
    await screen.findByRole('link', { name: 'サロンを選ぶ' })
    await arrangeLock(OPERATOR)
    await arrangeTwoFactor(OPERATOR)

    // Act
    goTo(userAccountHrefOf(await userIdOf(OPERATOR)))

    // Assert
    expect(await screen.findByText(OWN_ACCOUNT)).toBeVisible()
    expect(detailsOf()).toEqual(
      expect.arrayContaining([
        ['ロール', '管理者'],
        ['2 要素認証', '設定しています'],
        ['紐づいている台帳', 'どの台帳にも紐づいていません'],
      ]),
    )
    expect(screen.queryByRole('region', { name: 'ロックの解除' })).toBeNull()
    expect(
      screen.queryByRole('region', { name: '2 要素認証のリセット' }),
    ).toBeNull()
  })

  it.each<[string, () => Promise<unknown>]>([
    [
      'a customer with their account',
      async () => {
        await openAs(
          customerHrefOf(
            await salonIdOf(TOKYO),
            await customerIdOf(YUKI.email),
          ),
          OPERATOR,
        )
        return screen.findByRole('region', { name: 'ログインアカウント' })
      },
    ],
    [
      'an account to lift the lock of and to reset',
      async () => {
        await arrangeLock(YUKI.email)
        await arrangeTwoFactor(YUKI.email)
        await openAccountOf(YUKI.email)
        return screen.findByRole('region', { name: '2 要素認証のリセット' })
      },
    ],
    [
      'the dialog of a reset',
      async () => {
        await arrangeTwoFactor(YUKI.email)
        await openAccountOf(YUKI.email)
        return askToReset(userEvent.setup(), YUKI.email)
      },
    ],
  ])('should show %s accessibly', async (_, opened) => {
    // Arrange
    await opened()

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})
