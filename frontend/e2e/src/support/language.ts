import type { Locator, Page } from '@playwright/test'

/** The languages of the applications */
export type Language = 'en' | 'ja'

/** Where the applications keep the language their visitor chose */
const KEPT_AT = 'beauty-salon:language'

/** The name of the choice of the language, in the language of the page */
const CHOICE: Record<Language, string> = { ja: '言語', en: 'Language' }

/** How the choice names each language: in that language */
const NAMES: Record<Language, string> = { en: 'English', ja: '日本語' }

/**
 * Opens the pages of a test as the browser of a visitor who chose a
 * language before opens them: the choice is kept before a script of the
 * page runs.
 */
export const openInLanguage = async (
  page: Page,
  language: Language,
): Promise<void> => {
  await page.addInitScript(
    ({ key, chosen }) => {
      localStorage.setItem(key, chosen)
    },
    { key: KEPT_AT, chosen: language },
  )
}

/**
 * The choice of the language in a part of a page that says its texts in
 * `language`: the header, or the menu of a narrow screen
 */
export const languageChoiceIn = (part: Locator, language: Language): Locator =>
  part.getByRole('combobox', { name: CHOICE[language] })

/** The choice of the language in the header of a page that says its texts in `language` */
export const languageChoice = (page: Page, language: Language): Locator =>
  languageChoiceIn(page.getByRole('banner'), language)

/**
 * Chooses a language with the choice in the header of a page that is open
 * and says its texts in `from`, as its visitor does: the page and the other
 * tabs of the application say theirs in it from then on.
 */
export const chooseLanguage = async (
  page: Page,
  language: Language,
  from: Language = 'ja',
): Promise<void> => {
  await languageChoice(page, from).selectOption({ label: NAMES[language] })
}
