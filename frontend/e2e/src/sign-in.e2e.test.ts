import type { Locator, Page } from '@playwright/test'
import { ADMIN } from './applications'
import { findAccessibilityViolations } from './checks'
import { expect, test } from './fixtures'
import {
  ADMIN_START,
  emailField,
  enterCredentials,
  heading,
  OWNER,
  passwordField,
  setUpTwoFactor,
  signInButton,
  signOutButton,
} from './sign-in'

/** An address of the application other than its first screen */
const ADDRESS = `${ADMIN.origin}/customers/123`

/** Presses Tab until the element has the focus, as a user without a pointer does. */
const tabTo = async (page: Page, target: Locator): Promise<void> => {
  for (let presses = 0; presses < 10; presses += 1) {
    await page.keyboard.press('Tab')
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return
    }
  }
  await expect(target).toBeFocused()
}

test.describe('signing in, in a browser', () => {
  test('should show the sign-in screen at the address that was asked for, and the screen of that address once signed in', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADDRESS)
    await expect(heading(page, 'サインイン')).toBeVisible()
    await expect(page).toHaveTitle(`サインイン | ${ADMIN.title}`)
    const violations = await findAccessibilityViolations(page)

    // Act
    await enterCredentials(page, OWNER, api.seedPassword)

    // Assert
    await expect(heading(page, 'ページが見つかりません')).toBeFocused()
    await expect(page).toHaveURL(ADDRESS)
    await expect(page).toHaveTitle(`ページが見つかりません | ${ADMIN.title}`)
    await expect(page.getByText('サインインしました。')).toBeVisible()
    await expect(page.getByRole('banner')).toContainText(OWNER)
    expect(violations).toEqual([])
    expect(await findAccessibilityViolations(page)).toEqual([])
  })

  test('should name the fields that are missing, move the focus to the first of them and send nothing', async ({
    page,
    api,
  }) => {
    // Arrange
    const attempts: string[] = []
    page.on('request', (request) => {
      if (request.url().startsWith(`${api.origin}/api/v1/auth/login`)) {
        attempts.push(request.method())
      }
    })
    await page.goto(ADMIN.origin)

    // Act
    await signInButton(page).click()

    // Assert
    await expect(emailField(page)).toBeFocused()
    await expect(emailField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(passwordField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(
      page.getByText('メールアドレスを入力してください。'),
    ).toBeVisible()
    await expect(page.getByText('パスワードを入力してください。')).toBeVisible()
    expect(await findAccessibilityViolations(page)).toEqual([])
    expect(attempts).toEqual([])
  })

  test('should refuse a wrong password without saying which of the two is wrong', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)

    // Act
    await enterCredentials(page, OWNER, 'not the password')

    // Assert
    await expect(page.getByRole('alert')).toHaveText(
      'メールアドレスまたはパスワードが正しくありません。続けて 5 回誤ると、15 分間サインインできなくなります。',
    )
    await expect(heading(page, 'サインイン')).toBeVisible()
    expect(await findAccessibilityViolations(page)).toEqual([])
    expect(await api.query('select id from sessions')).toEqual([])
  })

  test('should need no pointer: the keyboard reaches the fields, sends the form and lands on the heading of the next screen', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await expect(heading(page, 'サインイン')).toBeVisible()

    // Act
    await tabTo(page, emailField(page))
    await page.keyboard.type(OWNER)
    await page.keyboard.press('Tab')
    const passwordIsNext = await passwordField(page).evaluate(
      (element) => element === document.activeElement,
    )
    await page.keyboard.type(api.seedPassword)
    await page.keyboard.press('Enter')

    // Assert
    expect(passwordIsNext).toBe(true)
    await expect(heading(page, ADMIN_START)).toBeFocused()
  })

  test('should keep the user signed in when the page is loaded again', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeVisible()

    // Act
    await page.reload()

    // Assert
    await expect(heading(page, ADMIN_START)).toBeVisible()
    await expect(signOutButton(page)).toBeVisible()
  })

  test('should sign the user out in every tab of the browser', async ({
    page,
    context,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeVisible()
    const otherTab = await context.newPage()
    await otherTab.goto(ADMIN.origin)
    await expect(heading(otherTab, ADMIN_START)).toBeVisible()

    // Act
    await signOutButton(otherTab).click()

    // Assert
    await expect(heading(otherTab, 'サインイン')).toBeVisible()
    await expect(heading(page, 'サインイン')).toBeVisible()
    expect(await api.query('select id from sessions')).toEqual([])
  })

  test('should ask an account with two-factor authentication for the code of its authenticator app', async ({
    page,
    request,
    api,
  }) => {
    // Arrange
    const { secret } = await setUpTwoFactor(request, api, OWNER)
    await page.goto(ADMIN.origin)
    await enterCredentials(page, OWNER, api.seedPassword)
    const code = page.getByRole('textbox', { name: '認証コード' })
    await expect(code).toBeFocused()
    const violations = await findAccessibilityViolations(page)

    // Act
    await code.fill(await api.authenticatorCode(secret, 1))
    await signInButton(page).click()

    // Assert
    await expect(heading(page, ADMIN_START)).toBeFocused()
    expect(violations).toEqual([])
  })
})
