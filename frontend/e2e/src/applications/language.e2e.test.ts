import { OWNER } from '@beauty-salon-frontend/testing/seed'
import { ADMIN, APPLICATIONS } from '../support/applications'
import { expectSoundPage } from '../support/checks'
import { expect, test } from '../support/fixtures'
import {
  chooseLanguage,
  type Language,
  openInLanguage,
} from '../support/language'
import { enterCredentials, heading } from '../support/sign-in'

/*
 * The language of a page: Japanese until its visitor chooses another one.
 * The document says it, the frame of the application says its texts in it,
 * and every request asks the API for it, whatever the browser asks for
 * (the browser of these tests asks for the English of the United States).
 * The sign-in screen says its texts in it too; the other screens are
 * written in Japanese alone so far.
 */

/** The link that every page begins with, which the frame of the applications says */
const SKIP_LINK: Record<Language, string> = {
  ja: '本文へ移動',
  en: 'Skip to content',
}

/** What the API says to a sign-in that failed */
const LOGIN_FAILED: Record<Language, { title: string; detail: string }> = {
  ja: {
    title: 'サインインできませんでした',
    detail: 'メールアドレスかパスワードが正しくありません',
  },
  en: { title: 'Login failed', detail: 'Invalid email or password' },
}

for (const application of APPLICATIONS) {
  test.describe(`the language of ${application.name}`, () => {
    test('should be Japanese for a visitor who chose none: in the document and in the frame', async ({
      page,
    }) => {
      // Act
      await page.goto(application.origin)

      // Assert
      await expect(
        page.getByRole('link', { name: SKIP_LINK.ja }),
      ).toBeAttached()
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    })

    test('should be English for a visitor who chose it: in the document and in the frame', async ({
      page,
    }) => {
      // Arrange
      await openInLanguage(page, 'en')

      // Act
      await page.goto(application.origin)

      // Assert
      await expect(
        page.getByRole('link', { name: SKIP_LINK.en }),
      ).toBeAttached()
      await expect(page.getByRole('link', { name: SKIP_LINK.ja })).toHaveCount(
        0,
      )
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      await expectSoundPage(page)
    })
  })
}

test.describe('the language a page asks the API for', () => {
  test('should be Japanese for a visitor who chose none, and the API answers in it', async ({
    page,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    const answered = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/auth/login'),
    )

    // Act
    await enterCredentials(page, OWNER, 'not the password of this account')

    // Assert
    const answer = await answered
    expect(await answer.request().headerValue('accept-language')).toBe('ja')
    expect(answer.status()).toBe(401)
    expect(answer.headers()['content-language']).toBe('ja')
    expect(await answer.json()).toMatchObject(LOGIN_FAILED.ja)
  })

  test('should be English for a visitor who chose it, and the API answers in it', async ({
    page,
  }) => {
    // Arrange
    await openInLanguage(page, 'en')
    await page.goto(ADMIN.origin)
    const answered = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/auth/login'),
    )

    // Act
    await enterCredentials(
      page,
      OWNER,
      'not the password of this account',
      'en',
    )

    // Assert
    const answer = await answered
    expect(await answer.request().headerValue('accept-language')).toBe('en')
    expect(answer.status()).toBe(401)
    expect(answer.headers()['content-language']).toBe('en')
    expect(await answer.json()).toMatchObject(LOGIN_FAILED.en)
  })
})

/** The languages of a page: Japanese is that of a visitor who chose none */
const LANGUAGES: readonly Language[] = ['ja', 'en']

/** The heading of the sign-in screen */
const SIGN_IN: Record<Language, string> = { ja: 'サインイン', en: 'Sign in' }

/** What the sign-in screen says of credentials that the API refused */
const WRONG_CREDENTIALS: Record<Language, string> = {
  ja: 'メールアドレスまたはパスワードが正しくありません。続けて 5 回誤ると、15 分間サインインできなくなります。',
  en: 'The email address or the password is not correct. After 5 wrong attempts in a row, you cannot sign in for 15 minutes.',
}

for (const language of LANGUAGES) {
  test.describe(`the sign-in screen, on a page whose language is ${language}`, () => {
    test('should say its texts, and that the credentials were refused, in the language of the page', async ({
      page,
    }) => {
      // Arrange
      await openInLanguage(page, language)
      await page.goto(ADMIN.origin)
      await expect(heading(page, SIGN_IN[language])).toBeVisible()

      // Act
      await enterCredentials(
        page,
        OWNER,
        'not the password of this account',
        language,
      )

      // Assert
      await expect(page.getByRole('alert')).toHaveText(
        WRONG_CREDENTIALS[language],
      )
      await expectSoundPage(page)
    })
  })
}

test.describe('a language that is chosen in another tab', () => {
  test('should be the language of a page that is open, without the page being loaded again', async ({
    page,
    context,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    const other = await context.newPage()
    await other.goto(ADMIN.origin)

    // Act
    await chooseLanguage(other, 'en')

    // Assert
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('link', { name: SKIP_LINK.en })).toBeAttached()
    await expect(page.getByRole('link', { name: SKIP_LINK.ja })).toHaveCount(0)
  })
})
