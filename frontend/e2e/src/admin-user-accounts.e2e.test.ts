import { CUSTOMER, OPERATOR, TOKYO } from '@beauty-salon-frontend/testing/seed'
import type { Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN, PORTAL } from './applications'
import { part } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { pressWithTheKeyboard } from './sales'
import {
  enterCredentials,
  heading,
  PORTAL_START,
  signOutButton,
} from './sign-in'

/*
 * The accounts of the users, from the side of the platform: its operator,
 * with the keyboard alone, goes from a customer of the ledger to the
 * account the customer signs in with, lifts the lock that wrong passwords
 * put on it, and resets the second factor the customer lost; the customer
 * then signs in to the portal with the password alone. The account, the
 * dialog of the reset and the way to an account from a member of the staff
 * are shown on a screen as narrow as a phone as well.
 */

/** The address of the customer of the seed data on the screens of the salon in Tokyo */
const customerPathOf = async (api: TestApi): Promise<string> =>
  `/salons/${await api.salonIdOf(TOKYO)}/customers/${await api.idOf(
    'select id::text from customers where email = $1',
    [CUSTOMER],
  )}`

/** The address of the account of the customer of the seed data */
const accountPathOf = async (api: TestApi): Promise<string> =>
  `/users/${await api.idOf('select id::text from users where email = $1', [
    CUSTOMER,
  ])}`

/** The address of the login account of the first stylist of the seed data, on the screens of the salon in Tokyo */
const staffAccountPathOf = async (api: TestApi): Promise<string> =>
  `/salons/${await api.salonIdOf(TOKYO)}/staff/${await api.idOf(
    'select id::text from staff where "staffCode" = $1',
    ['STF001'],
  )}/account`

/** Lets wrong passwords have locked the account of the customer, who signs in with two factors. */
const arrangeLockedWithTwoFactors = (api: TestApi): Promise<unknown> =>
  api.query(
    `update users set status = 'locked', "failedLoginAttempts" = 5,
                      "lockedUntil" = now() + interval '5 minutes',
                      "twoFactorStatus" = 'enabled', "twoFactorSecret" = 'arranged',
                      "backupCodes" = '[]'::jsonb
     where email = $1`,
    [CUSTOMER],
  )

const storedSchema = z.array(
  z.object({
    status: z.string(),
    failedLoginAttempts: z.number(),
    locked: z.boolean(),
    twoFactorStatus: z.string(),
    secretKept: z.boolean(),
  }),
)

/** The lock and the second factor of the account of the customer, as the database of the API has them */
const stored = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select status::text, "failedLoginAttempts", "lockedUntil" is not null as locked,
              "twoFactorStatus"::text as "twoFactorStatus",
              "twoFactorSecret" is not null as "secretKept"
       from users where email = $1`,
      [CUSTOMER],
    ),
  )

/** The record of the account on its screen */
const record = (page: Page) => part(page, 'アカウントの状態')

test.describe('the accounts of the users, in a browser', () => {
  test('should let the operator lift the lock and reset the second factor of a customer with the keyboard, who then signs in with the password', async ({
    page,
    api,
  }) => {
    // Arrange
    await arrangeLockedWithTwoFactors(api)
    await page.goto(`${ADMIN.origin}${await customerPathOf(api)}`)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    const account = part(page, 'ログインアカウント')
    await expect(account).toBeVisible()

    // Act
    await pressWithTheKeyboard(
      account.getByRole('link', { name: 'アカウントの状態を見る' }),
    )

    // Assert
    await expect(heading(page, 'ログインアカウント')).toBeFocused()
    await expect(record(page)).toContainText('5 回続けて誤っています')

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: 'ロックを解除する' }),
    )

    // Assert
    await expect(
      page.getByText(
        `${CUSTOMER} のロックを解除しました。いまのパスワードで、すぐにログインできます。`,
      ),
    ).toBeVisible()
    await expect(
      record(page).getByRole('heading', { name: 'アカウントの状態' }),
    ).toBeFocused()
    await expect(part(page, 'ロックの解除')).toHaveCount(0)

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '2 要素認証をリセットする' }),
    )
    const dialog = page.getByRole('dialog', {
      name: `${CUSTOMER} の 2 要素認証をリセットしますか？`,
    })
    await pressWithTheKeyboard(
      dialog.getByRole('button', { name: 'リセットする' }),
    )

    // Assert
    await expect(
      page.getByText(
        `${CUSTOMER} の 2 要素認証をリセットしました。パスワードだけでログインできます。利用者には、メールで知らせます。`,
      ),
    ).toBeVisible()
    await expect(dialog).toBeHidden()
    await expect(
      record(page).getByRole('heading', { name: 'アカウントの状態' }),
    ).toBeFocused()
    await expect(part(page, '2 要素認証のリセット')).toHaveCount(0)
    expect(await stored(api)).toEqual([
      {
        status: 'active',
        failedLoginAttempts: 0,
        locked: false,
        twoFactorStatus: 'disabled',
        secretKept: false,
      },
    ])
    await expect
      .poll(async () =>
        (await api.mails()).map(({ to, subject }) => [to, subject]),
      )
      .toEqual([[CUSTOMER, '2 要素認証が管理者によって無効にされました']])

    // Act
    await page.goto(`${PORTAL.origin}/sign-in`)
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Assert
    await expect(heading(page, PORTAL_START)).toBeFocused()
    await expect(page.getByRole('banner')).toContainText(CUSTOMER)
    await expect(signOutButton(page)).toBeVisible()
  })
})

test.describe('the accounts of the users, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the account, its operations, the dialog of a reset and the way from a member of the staff into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await arrangeLockedWithTwoFactors(api)
    await page.goto(`${ADMIN.origin}${await accountPathOf(api)}`)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(
      page.getByRole('button', { name: '2 要素認証をリセットする' }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('button', { name: '2 要素認証をリセットする' }).click()
    await expect(
      page.getByRole('dialog', {
        name: `${CUSTOMER} の 2 要素認証をリセットしますか？`,
      }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('button', { name: '戻る' }).click()
    await page.goto(`${ADMIN.origin}${await staffAccountPathOf(api)}`)
    await expect(
      page.getByRole('link', { name: 'アカウントの状態を見る' }),
    ).toBeVisible()

    // Assert
    await expect(
      page.getByRole('button', { name: '紐づけを解除する' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
