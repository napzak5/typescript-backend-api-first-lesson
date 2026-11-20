import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN, PORTAL } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import {
  ADMIN_START,
  enterCredentials,
  heading,
  OWNER,
  passwordField,
  signOutButton,
} from './sign-in'

/*
 * The accounts of the staff as the owner of a salon keeps them, with the
 * keyboard alone: Yui Watanabe, who has no account in the seed data, is
 * invited from her page in the staff ledger, makes her account from the
 * link of the mail in the portal, signs in to the admin application, and is
 * given the role of a manager by the owner. Hiroshi Tanaka's account is
 * shown on a screen as narrow as a phone.
 */

const WATANABE = 'yui.watanabe@beautysalon.jp'
const PASSWORD = 'a passphrase that only this test knows'

const idSchema = z.tuple([z.object({ id: z.uuid() })])

/** A member of the seed data, by their staff code. */
const staffIdOf = async (api: TestApi, staffCode: string): Promise<string> => {
  const [{ id }] = idSchema.parse(
    await api.query('select id::text from staff where "staffCode" = $1', [
      staffCode,
    ]),
  )

  return id
}

const accountSchema = z.array(
  z.object({ role: z.string(), linked: z.boolean() }),
)

/** The role of the account of an address, and whether a member is linked to it, as the database of the API has it. */
const storedAccountOf = async (api: TestApi, email: string) =>
  accountSchema.parse(
    await api.query(
      `select users.role::text as role, staff."userId" = users.id as linked
       from users join staff on staff.id = users."staffId"
       where users.email = $1`,
      [email],
    ),
  )

/** The heading of a card: where the focus is after a write changed what the screen shows. */
const cardHeading = (page: Page, name: string): Locator =>
  page.getByRole('heading', { level: 2, name, exact: true })

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

/** Chooses a radio button with the keyboard. */
const chooseWithTheKeyboard = async (radio: Locator): Promise<void> => {
  await radio.focus()
  await radio.press('Space')
}

test.describe('the accounts of the staff, in a browser', () => {
  test('should invite a member, let her make her account and sign in, and give her another role, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const member = await staffIdOf(api, 'STF004')
    await page.goto(`${ADMIN.origin}/salons/${salon}/staff/${member}`)
    await enterCredentials(page, OWNER, api.seedPassword)

    // Act: the invitation, from the page of the member
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'ログインアカウント' }),
    )
    await expect(
      page.getByText(/台帳のメールアドレス（yui\.watanabe@beautysalon\.jp）/),
    ).toBeVisible()
    await chooseWithTheKeyboard(page.getByRole('radio', { name: 'スタッフ' }))
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '招待メールを送る' }),
    )

    // Assert
    await expect(cardHeading(page, '招待')).toBeFocused()
    await expect(
      page.getByText('Yui Watanabe さんに、招待メールを送りました。'),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: '招待', exact: true }),
    ).toContainText('受け入れ待ち')

    // Act: the link of the mail, a password, and on to the admin application
    await signOutButton(page).click()
    await page.goto(await api.mailedLink(WATANABE))
    await expect(heading(page, 'スタッフアカウントへの招待')).toBeVisible()
    const invitationPage = page.url()
    await passwordField(page).fill(PASSWORD)
    await page.getByRole('button', { name: 'アカウントを作る' }).click()
    await expect(heading(page, 'アカウントを作りました')).toBeFocused()
    await page.getByRole('link', { name: '店舗向けの画面を開く' }).click()
    await enterCredentials(page, WATANABE, PASSWORD)

    // Assert
    await expect(heading(page, ADMIN_START)).toBeFocused()
    await expect(page.getByRole('banner')).toContainText(WATANABE)

    // Act: the owner sees the account that was made, and gives it the role of a manager
    await signOutButton(page).click()
    await page.goto(`${ADMIN.origin}/salons/${salon}/staff/${member}/account`)
    await enterCredentials(page, OWNER, api.seedPassword)
    const account = page.getByRole('region', {
      name: 'ログインアカウント',
      exact: true,
    })
    await expect(account).toContainText(WATANABE)
    await expect(account).not.toContainText('まだログインしていません')
    await chooseWithTheKeyboard(
      page.getByRole('radio', { name: 'マネージャー' }),
    )
    await pressWithTheKeyboard(
      page.getByRole('button', { name: 'ロールを変える' }),
    )

    // Assert
    await expect(
      page.getByText(
        'Yui Watanabe さんのロールを、マネージャーにしました。次の操作から、新しいロールで扱われます。',
      ),
    ).toBeVisible()
    await expect(account).toContainText('マネージャー')
    expect(await storedAccountOf(api, WATANABE)).toEqual([
      { role: 'manager', linked: true },
    ])
    expect(invitationPage).toBe(`${PORTAL.origin}/accept-staff-invitation`)
  })
})

test.describe('the accounts of the staff, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit an account, the dialog of an unlinking and an invitation into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(
      `${ADMIN.origin}/salons/${salon}/staff/${await staffIdOf(api, 'STF001')}/account`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)

    // Act
    await expect(page.getByRole('radiogroup', { name: 'ロール' })).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('button', { name: '紐づけを解除する' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '解除する' })
      .click()
    await expect(cardHeading(page, '招待する')).toBeFocused()

    // Assert
    await expectSoundPage(page)
  })
})
