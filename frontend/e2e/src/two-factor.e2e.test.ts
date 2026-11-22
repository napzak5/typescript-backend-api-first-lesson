import { CUSTOMER } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import { PORTAL } from './applications'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { part, pressWithTheKeyboard } from './screen'
import { enterCredentials, heading, signOutButton } from './sign-in'

/*
 * The customer is the first of the seed data, whose password is the one
 * every seeded account has. The screens are those of the session package;
 * the portal puts them below the page of the customer.
 */

const SECURITY = `${PORTAL.origin}/mypage/security`
const SET_UP = '2 要素認証を設定する'
const ISSUE = 'バックアップコードを発行し直す'
const STOP = '2 要素認証を無効にする'
const CODE_OR_BACKUP = '認証アプリのコードかバックアップコード'

/** A heading inside the screen, where the focus goes when a step begins. */
const stepHeading = (page: Page, name: string): Locator =>
  page.getByRole('heading', { level: 2, name })

const issueDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: ISSUE })

const stopDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: '2 要素認証を無効にしますか？' })

const backupCodes = (page: Page): Locator =>
  page.getByRole('list', { name: 'バックアップコード' }).getByRole('listitem')

/** The secret the screen shows, as an authenticator app takes it. */
const shownSecret = async (page: Page): Promise<string> =>
  (
    (await part(page, '認証アプリに登録する')
      .getByRole('code')
      .textContent()) ?? ''
  ).replaceAll(' ', '')

/** What the database keeps of the second factor of the customer. */
const twoFactorOf = async (api: TestApi) => {
  const [row] = await api.query(
    `select "twoFactorStatus" as status, coalesce(jsonb_array_length("backupCodes"), 0) as "backupCodes"
       from users where email = $1`,
    [CUSTOMER],
  )

  return row
}

/** Follows the link of the security of the account to the set-up, with a pointer. */
const toTheSetUp = async (page: Page): Promise<void> => {
  await page.getByRole('link', { name: SET_UP }).click()
  await expect(heading(page, SET_UP)).toBeFocused()
}

/** Goes through the set-up with a pointer, up to the backup codes, and returns the secret and the codes. */
const setUpOnTheScreen = async (page: Page, api: TestApi) => {
  await toTheSetUp(page)
  await page.getByLabel('パスワード', { exact: true }).fill(api.seedPassword)
  await page.getByRole('button', { name: '設定を始める' }).click()
  await expect(stepHeading(page, '認証アプリに登録する')).toBeFocused()
  const secret = await shownSecret(page)
  await page
    .getByLabel('認証アプリのコード', { exact: true })
    .fill(await api.authenticatorCode(secret))
  await page.getByRole('button', { name: '2 要素認証を有効にする' }).click()
  await expect(stepHeading(page, '2 要素認証を有効にしました')).toBeFocused()

  return { secret, codes: await backupCodes(page).allTextContents() }
}

test.describe('the second factor of the account of a customer, in a browser', () => {
  test('should set it up, sign in with it, issue new backup codes and turn it off, with the keyboard alone', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(SECURITY)
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await expect(heading(page, 'アカウントの安全')).toBeFocused()

    // Act: to the set-up, and past the password
    await pressWithTheKeyboard(page.getByRole('link', { name: SET_UP }))
    await expect(heading(page, SET_UP)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('パスワード', { exact: true })).toBeFocused()
    await page.keyboard.type(api.seedPassword)
    await page.keyboard.press('Enter')

    // Assert
    await expect(stepHeading(page, '認証アプリに登録する')).toBeFocused()
    await expect(
      page.getByRole('img', { name: '認証アプリで読み取る QR コード' }),
    ).toBeVisible()
    await expectSoundPage(page)
    expect(await twoFactorOf(api)).toEqual({
      status: 'pending',
      backupCodes: 10,
    })

    // Act: the code of the app, as the app shows it
    const secret = await shownSecret(page)
    const code = await api.authenticatorCode(secret)
    await page.keyboard.press('Tab')
    await expect(
      page.getByLabel('認証アプリのコード', { exact: true }),
    ).toBeFocused()
    await page.keyboard.type(`${code.slice(0, 3)} ${code.slice(3)}`)
    await page.keyboard.press('Enter')

    // Assert
    await expect(stepHeading(page, '2 要素認証を有効にしました')).toBeFocused()
    await expect(backupCodes(page)).toHaveCount(10)
    const codes = await backupCodes(page).allTextContents()
    await expectSoundPage(page)
    expect(await twoFactorOf(api)).toEqual({
      status: 'enabled',
      backupCodes: 10,
    })

    // Act: back to the security of the account
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('link', { name: 'アカウントの安全へ戻る' }),
    ).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert
    await expect(heading(page, 'アカウントの安全')).toBeFocused()
    await expect(part(page, '2 要素認証').getByText('有効')).toBeVisible()

    // Act: out, and in again with the code of the next 30 seconds
    await pressWithTheKeyboard(signOutButton(page))
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    const signInCode = page.getByRole('textbox', { name: '認証コード' })
    await expect(signInCode).toBeFocused()
    await page.keyboard.type(await api.authenticatorCode(secret, 1))
    await page.keyboard.press('Enter')

    // Assert
    await expect(heading(page, 'アカウントの安全')).toBeFocused()

    // Act: new backup codes, after one of the codes of the set-up
    const issue = page.getByRole('button', { name: ISSUE })
    await pressWithTheKeyboard(issue)
    // The browser gives the focus to the first control of the dialog
    await expect(issueDialog(page).getByLabel(CODE_OR_BACKUP)).toBeFocused()
    await page.keyboard.type(codes[0] ?? '')
    await page.keyboard.press('Enter')

    // Assert: the focus is on the answer, which begins with what is said of the codes
    await expect(
      issueDialog(page)
        .getByText(/^新しいバックアップコードです。/)
        .locator('..'),
    ).toBeFocused()
    const issued = await issueDialog(page).getByRole('code').allTextContents()
    expect(issued).toHaveLength(10)
    expect(issued.some((issuedCode) => codes.includes(issuedCode))).toBe(false)
    await expectSoundPage(page)

    // Act: closed, the dialog gives the focus back to the button that opened it
    await page.keyboard.press('Tab')
    await expect(
      issueDialog(page).getByRole('button', { name: '閉じる' }),
    ).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert
    await expect(issueDialog(page)).toHaveCount(0)
    await expect(issue).toBeFocused()

    // Act: off, after the password and one of the new codes
    await pressWithTheKeyboard(page.getByRole('button', { name: STOP }))
    await expect(
      stopDialog(page).getByLabel('パスワード', { exact: true }),
    ).toBeFocused()
    await page.keyboard.type(api.seedPassword)
    await page.keyboard.press('Tab')
    await expect(
      stopDialog(page).getByRole('checkbox', { name: 'パスワードを表示する' }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(stopDialog(page).getByLabel(CODE_OR_BACKUP)).toBeFocused()
    await page.keyboard.type(issued[0] ?? '')
    await page.keyboard.press('Enter')

    // Assert
    await expect(stopDialog(page)).toHaveCount(0)
    await expect(stepHeading(page, '2 要素認証')).toBeFocused()
    await expect(
      page.getByText('2 要素認証を無効にしました。', { exact: false }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: SET_UP })).toBeVisible()
    expect(await twoFactorOf(api)).toEqual({
      status: 'disabled',
      backupCodes: 0,
    })
  })
})

test.describe('the second factor, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the QR code, the secret, the backup codes and both dialogs into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(SECURITY)
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Act
    await toTheSetUp(page)
    await page.getByLabel('パスワード', { exact: true }).fill(api.seedPassword)
    await page.getByRole('button', { name: '設定を始める' }).click()

    // Assert: the QR code is whole, and large enough for a camera
    const qrCode = page.getByRole('img', {
      name: '認証アプリで読み取る QR コード',
    })
    await expect(qrCode).toBeVisible()
    const box = await qrCode.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(160)
    expect(box?.width).toBe(box?.height)
    await expectSoundPage(page)

    // Act
    await page.getByLabel('認証アプリのコード', { exact: true }).fill('12345')
    await page.getByRole('button', { name: '2 要素認証を有効にする' }).click()

    // Assert
    await expect(
      page.getByLabel('認証アプリのコード', { exact: true }),
    ).toHaveAccessibleDescription(
      /^認証アプリに表示されている 6 桁の数字です。バックアップコードは使えません。\s*コードは 6 桁の数字です。/,
    )
    await expectSoundPage(page)

    // Act
    await page
      .getByLabel('認証アプリのコード', { exact: true })
      .fill(await api.authenticatorCode(await shownSecret(page)))
    await page.getByRole('button', { name: '2 要素認証を有効にする' }).click()

    // Assert
    await expect(backupCodes(page)).toHaveCount(10)
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: 'アカウントの安全へ戻る' }).click()
    await page.getByRole('button', { name: ISSUE }).click()

    // Assert
    await expect(issueDialog(page)).toBeVisible()
    await expectSoundPage(page)

    // Act
    await issueDialog(page).getByRole('button', { name: '戻る' }).click()
    await page.getByRole('button', { name: STOP }).click()
    await stopDialog(page).getByRole('button', { name: '無効にする' }).click()

    // Assert
    await expect(
      stopDialog(page).getByLabel('パスワード', { exact: true }),
    ).toBeFocused()
    await expectSoundPage(page)
  })

  test('should fit the new backup codes into the dialog', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(SECURITY)
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    const { codes } = await setUpOnTheScreen(page, api)
    await page.getByRole('link', { name: 'アカウントの安全へ戻る' }).click()
    await page.getByRole('button', { name: ISSUE }).click()

    // Act
    await issueDialog(page)
      .getByLabel(CODE_OR_BACKUP)
      .fill(codes[0] ?? '')
    await issueDialog(page).getByRole('button', { name: '発行し直す' }).click()

    // Assert
    await expect(issueDialog(page).getByRole('code')).toHaveCount(10)
    await expectSoundPage(page)
  })
})
