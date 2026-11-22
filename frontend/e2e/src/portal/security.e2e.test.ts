import { CUSTOMER } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import { PORTAL } from '../support/applications'
import { expectSoundPage } from '../support/checks'
import { expect, type TestApi, test } from '../support/fixtures'
import { part, pressWithTheKeyboard } from '../support/screen'
import {
  enterCredentials,
  heading,
  passwordField,
  signOutButton,
} from '../support/sign-in'

/*
 * The customer is the first of the seed data, whose password is the one
 * every seeded account has. The screens are those of the session package;
 * the portal puts them below the page of the customer.
 */

const SECURITY = `${PORTAL.origin}/mypage/security`
const NEW_PASSWORD = 'aoi sora to shiroi kumo no aida'
const DEVICES = 'サインインしている端末'
const CHANGED =
  'パスワードを変更しました。この端末のほかは、すべての端末でサインアウトしました。変更したことを、メールでお知らせしました。'

/*
 * What a browser sends that no line can be broken in: a User-Agent the API
 * keeps as it came.
 */
const LONG_USER_AGENT = `Mozilla/5.0_${'(Linux;_Android_19;_Pixel_12_Pro_Build/AP4A.261105.007)_'.repeat(3)}Chrome/150.0.0.0_Mobile_Safari/537.36`

const currentPassword = (page: Page): Locator =>
  page.getByLabel('現在のパスワード', { exact: true })

const newPassword = (page: Page): Locator =>
  page.getByLabel('新しいパスワード', { exact: true })

const devices = (page: Page): Locator =>
  page.getByRole('list', { name: DEVICES }).getByRole('listitem')

const count = (page: Page): Locator => part(page, DEVICES).getByRole('status')

const signOutOthers = (page: Page): Locator =>
  page.getByRole('button', { name: /をサインアウトさせる$/ })

const everywhereButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'すべての端末でサインアウトする' })

const dialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'すべての端末でサインアウトしますか？' })

/** The sessions of the customer, as the database of the API has them. */
const sessions = (api: TestApi) =>
  api.query(
    `select s.id from sessions s join users u on u.id = s."userId" where u.email = $1`,
    [CUSTOMER],
  )

test.describe('the security of the account of a customer, in a browser', () => {
  test('should change the password with the keyboard, keep the customer signed in, and take the new password at the next sign-in', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${PORTAL.origin}/mypage`)
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Act: from my page to the security of the account
    await pressWithTheKeyboard(
      part(page, 'アカウントの安全').getByRole('link', {
        name: 'アカウントの安全を確かめる',
      }),
    )

    // Assert
    await expect(heading(page, 'アカウントの安全')).toBeFocused()
    await expect(count(page)).toHaveText('1 台の端末でサインインしています')
    await expect(devices(page).getByText('この端末')).toBeVisible()
    await expectSoundPage(page)

    // Act: to the form, and through it with Tab
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'パスワードを変更する' }),
    )
    await expect(heading(page, 'パスワードを変更する')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(currentPassword(page)).toBeFocused()
    await page.keyboard.type(api.seedPassword)
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('checkbox', { name: '現在のパスワードを表示する' }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(newPassword(page)).toBeFocused()
    await page.keyboard.type(NEW_PASSWORD)
    await page.keyboard.press('Enter')

    // Assert
    await expect(heading(page, 'アカウントの安全')).toBeFocused()
    await expect(page).toHaveURL(SECURITY)
    await expect(page.getByText(CHANGED)).toBeVisible()
    await expect(
      part(page, 'パスワード').getByText(
        'アカウントを作ってから、変更していません',
      ),
    ).toHaveCount(0)
    expect(await sessions(api)).toHaveLength(1)

    // Act: out, and in again with the old password and the new one
    await pressWithTheKeyboard(signOutButton(page))
    await expect(heading(page, 'サインイン')).toBeFocused()
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await expect(
      page.getByText('メールアドレスまたはパスワードが正しくありません。', {
        exact: false,
      }),
    ).toBeVisible()
    await passwordField(page).fill(NEW_PASSWORD)
    await passwordField(page).press('Enter')

    // Assert
    await expect(heading(page, 'アカウントの安全')).toBeFocused()
  })

  test('should sign out another device, which then has to sign in again, and then every device, this one too', async ({
    page,
    browser,
    api,
  }) => {
    // Arrange: a phone, which is another browser
    const phone = await browser.newPage()
    await phone.goto(`${PORTAL.origin}/mypage`)
    await enterCredentials(phone, CUSTOMER, api.seedPassword)
    await expect(heading(phone, 'マイページ')).toBeVisible()
    await page.goto(SECURITY)
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await expect(count(page)).toHaveText('2 台の端末でサインインしています')

    // Act
    await pressWithTheKeyboard(signOutOthers(page))

    // Assert
    await expect(count(page)).toHaveText('1 台の端末でサインインしています')
    await expect(
      part(page, DEVICES).getByRole('heading', { level: 2, name: DEVICES }),
    ).toBeFocused()
    await expect(signOutOthers(page)).toHaveCount(0)
    await phone.reload()
    await expect(heading(phone, 'サインイン')).toBeVisible()

    // Act: every device, after the dialog asked
    await pressWithTheKeyboard(everywhereButton(page))
    await expect(
      dialog(page).getByRole('button', { name: '戻る' }),
    ).toBeFocused()
    await expectSoundPage(page)
    await page.keyboard.press('Tab')
    await expect(
      dialog(page).getByRole('button', { name: 'サインアウトする' }),
    ).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert
    await expect(heading(page, 'サインイン')).toBeVisible()
    await expect(
      page.getByText('すべての端末でサインアウトしました。'),
    ).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
    expect(await sessions(api)).toEqual([])
    await phone.close()
  })
})

test.describe('the security of the account, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit a device with a long browser, the form with what is wrong, and the dialog into the width', async ({
    page,
    browser,
    api,
  }) => {
    // Arrange
    const phone = await browser.newPage()
    await phone.goto(`${PORTAL.origin}/mypage`)
    await enterCredentials(phone, CUSTOMER, api.seedPassword)
    await expect(heading(phone, 'マイページ')).toBeVisible()
    await phone.close()
    await api.query(
      `update sessions set "userAgent" = $2
        where "userId" = (select id from users where email = $1)`,
      [CUSTOMER, LONG_USER_AGENT],
    )
    await page.goto(SECURITY)
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Assert
    await expect(count(page)).toHaveText('2 台の端末でサインインしています')
    await expect(devices(page).getByText(LONG_USER_AGENT)).toBeVisible()
    await expectSoundPage(page)
    // The mark of this device stands beside its name, at the same height
    const mine = devices(page).filter({ hasText: 'この端末' })
    const name = await mine.getByRole('heading', { level: 3 }).boundingBox()
    const mark = await mine.getByText('この端末').boundingBox()
    expect(name).not.toBeNull()
    expect(mark?.x).toBeGreaterThan(name?.x ?? Number.POSITIVE_INFINITY)
    expect(mark?.y).toBeLessThan((name?.y ?? 0) + (name?.height ?? 0))

    // Act
    await everywhereButton(page).click()

    // Assert
    await expect(dialog(page)).toBeVisible()
    await expectSoundPage(page)

    // Act
    await dialog(page).getByRole('button', { name: '戻る' }).click()
    await page.getByRole('link', { name: 'パスワードを変更する' }).click()
    await currentPassword(page).fill('not the password of the account')
    await newPassword(page).fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'パスワードを変更する' }).click()

    // Assert
    await expect(currentPassword(page)).toBeFocused()
    await expect(currentPassword(page)).toHaveAccessibleDescription(
      '現在のパスワードが違います。5 回続けて違うと、15 分間、サインインもできなくなります。',
    )
    await expectSoundPage(page)
  })
})
