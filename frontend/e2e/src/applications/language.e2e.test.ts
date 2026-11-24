import { OWNER } from '@beauty-salon-frontend/testing/seed'
import type { Page } from '@playwright/test'
import { ADMIN, APPLICATIONS, PORTAL } from '../support/applications'
import { expectSoundPage } from '../support/checks'
import { expect, test } from '../support/fixtures'
import {
  chooseLanguage,
  type Language,
  languageChoice,
  languageChoiceIn,
  openInLanguage,
} from '../support/language'
import { menu, menuButton } from '../support/main-menu'
import {
  ADMIN_START,
  emailField,
  enterCredentials,
  heading,
  passwordField,
} from '../support/sign-in'

/*
 * The language of a page: the one its visitor chose with the choice in the
 * header, else the one the browser is set to, else Japanese. The browser of
 * these tests is set to the Japanese of Japan (`locale` of the
 * configuration), unless a test sets it to another language. The document
 * says the language, the frame and the screens say their texts in it, and
 * every request asks the API for it, whatever the browser asks for.
 */

/** An address that has no account, and a password the API takes */
const VISITOR = 'first.visit@example.com'
const VISITOR_PASSWORD = 'kirei na kami de dekakeru'

/** The link that every page begins with, which the frame of the applications says */
const SKIP_LINK: Record<Language, string> = {
  ja: '本文へ移動',
  en: 'Skip to content',
}

/** The name of the menu of a narrow screen */
const MAIN_MENU: Record<Language, string> = {
  ja: 'メインメニュー',
  en: 'Main menu',
}

/** What the API says to a sign-in that failed */
const LOGIN_FAILED: Record<Language, { title: string; detail: string }> = {
  ja: {
    title: 'サインインできませんでした',
    detail: 'メールアドレスかパスワードが正しくありません',
  },
  en: { title: 'Login failed', detail: 'Invalid email or password' },
}

/** That the document and the frame of the page say their texts in the language */
const expectPageIn = async (page: Page, language: Language): Promise<void> => {
  await expect(page.locator('html')).toHaveAttribute('lang', language)
  await expect(
    page.getByRole('link', { name: SKIP_LINK[language] }),
  ).toBeAttached()
}

/**
 * Signs in with a wrong password on the sign-in screen of the admin
 * application, and answers what the page asked the API and what it was
 * answered
 */
const failedSignIn = async (page: Page, language: Language) => {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/auth/login'),
  )
  await enterCredentials(
    page,
    OWNER,
    'not the password of this account',
    language,
  )
  const answer = await answered
  const body: unknown = await answer.json()

  return {
    asked: await answer.request().headerValue('accept-language'),
    status: answer.status(),
    language: answer.headers()['content-language'],
    body,
  }
}

for (const application of APPLICATIONS) {
  test.describe(`the language of ${application.name}`, () => {
    test('should be Japanese for a visitor who chose none, in a browser set to Japanese: in the document, in the frame and in the choice', async ({
      page,
    }) => {
      // Act
      await page.goto(application.origin)

      // Assert
      await expectPageIn(page, 'ja')
      await expect(languageChoice(page, 'ja')).toHaveValue('ja')
    })

    test('should be English for a visitor who chose it: in the document and in the frame', async ({
      page,
    }) => {
      // Arrange
      await openInLanguage(page, 'en')

      // Act
      await page.goto(application.origin)

      // Assert
      await expectPageIn(page, 'en')
      await expect(page.getByRole('link', { name: SKIP_LINK.ja })).toHaveCount(
        0,
      )
      await expectSoundPage(page)
    })

    test('should be the language that is chosen in the header, at once and after a reload', async ({
      page,
    }) => {
      // Arrange
      await page.goto(application.origin)
      await expectPageIn(page, 'ja')

      // Act
      await chooseLanguage(page, 'en')

      // Assert
      await expectPageIn(page, 'en')
      await expect(languageChoice(page, 'en')).toHaveValue('en')
      await page.reload()
      await expectPageIn(page, 'en')
      await expectSoundPage(page)
    })
  })
}

test.describe('the choice of the language with the keyboard', () => {
  test('should be reached after the name of the application, and chosen by typing the name of a language', async ({
    page,
  }) => {
    // Arrange
    await page.goto(PORTAL.origin)
    await expectPageIn(page, 'ja')
    // The link to the content, the name of the application, the choice
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(languageChoice(page, 'ja')).toBeFocused()

    // Act: the select chooses the option whose name begins with what is typed
    await page.keyboard.type('Eng')

    // Assert
    await expectPageIn(page, 'en')
    await expect(languageChoice(page, 'en')).toBeFocused()
  })
})

test.describe('a visitor who chose no language, in a browser set to the English of the United States', () => {
  test.use({ locale: 'en-US' })

  test('should be in English, and ask the API in English', async ({ page }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await expectPageIn(page, 'en')

    // Act
    const answer = await failedSignIn(page, 'en')

    // Assert
    expect(answer).toEqual({
      asked: 'en',
      status: 401,
      language: 'en',
      body: expect.objectContaining(LOGIN_FAILED.en),
    })
  })

  test('should be in Japanese once Japanese is chosen, and ask the API in it, whatever the browser asks for', async ({
    page,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await chooseLanguage(page, 'ja', 'en')
    await expectPageIn(page, 'ja')

    // Act
    const answer = await failedSignIn(page, 'ja')

    // Assert
    expect(answer).toEqual({
      asked: 'ja',
      status: 401,
      language: 'ja',
      body: expect.objectContaining(LOGIN_FAILED.ja),
    })
  })

  test('should register an account in English, and be mailed its link in English', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${PORTAL.origin}/register`)
    await expectPageIn(page, 'en')

    // Act
    await emailField(page, 'en').fill(VISITOR)
    await passwordField(page, 'en').fill(VISITOR_PASSWORD)
    await page.getByRole('button', { name: 'Register' }).click()

    // Assert
    await expect(heading(page, 'We sent you a confirmation mail')).toBeFocused()
    expect(
      (await api.mails()).map(({ to, language, subject }) => [
        to,
        language,
        subject,
      ]),
    ).toEqual([[VISITOR, 'en', 'Confirm your email address']])
  })
})

test.describe('a visitor who chose no language, in a browser set to a language the product is not written in', () => {
  test.use({ locale: 'fr-FR' })

  test('should be in Japanese', async ({ page }) => {
    // Act
    await page.goto(PORTAL.origin)

    // Assert
    await expectPageIn(page, 'ja')
  })
})

test.describe('the language a page asks the API for', () => {
  test('should be Japanese for a visitor who chose none, in a browser set to Japanese, and the API answers in it', async ({
    page,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)

    // Act
    const answer = await failedSignIn(page, 'ja')

    // Assert
    expect(answer).toEqual({
      asked: 'ja',
      status: 401,
      language: 'ja',
      body: expect.objectContaining(LOGIN_FAILED.ja),
    })
  })

  test('should be English for a visitor who chose it, and the API answers in it', async ({
    page,
  }) => {
    // Arrange
    await openInLanguage(page, 'en')
    await page.goto(ADMIN.origin)

    // Act
    const answer = await failedSignIn(page, 'en')

    // Assert
    expect(answer).toEqual({
      asked: 'en',
      status: 401,
      language: 'en',
      body: expect.objectContaining(LOGIN_FAILED.en),
    })
  })
})

/** The languages of a page: Japanese is that of a visitor who chose none, in a browser set to Japanese */
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

test.describe('the choice of the language on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should be in the menu of a member who is signed in, and leave the menu open, saying its texts in the language chosen', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeVisible()
    await expect(page.getByRole('banner').getByRole('combobox')).toHaveCount(0)
    await menuButton(page).click()

    // Act
    await languageChoiceIn(menu(page), 'ja').selectOption({ label: 'English' })

    // Assert
    const englishMenu = page.getByRole('dialog', { name: MAIN_MENU.en })
    await expect(englishMenu).toBeVisible()
    await expect(languageChoiceIn(englishMenu, 'en')).toHaveValue('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expectSoundPage(page)
  })

  test('should stand in the header beside the way in, for a visitor of the portal on a screen 320 pixels wide', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 320, height: 640 })

    // Act
    await page.goto(PORTAL.origin)

    // Assert
    await expect(languageChoice(page, 'ja')).toBeVisible()
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'サインイン' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})

test.describe('a language that is chosen in another tab', () => {
  test('should be the language of a page that is open, without the page being loaded again', async ({
    page,
    context,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await expectPageIn(page, 'ja')
    const other = await context.newPage()
    await other.goto(ADMIN.origin)

    // Act
    await chooseLanguage(other, 'en')

    // Assert
    await expectPageIn(page, 'en')
    await expect(page.getByRole('link', { name: SKIP_LINK.ja })).toHaveCount(0)
  })
})
