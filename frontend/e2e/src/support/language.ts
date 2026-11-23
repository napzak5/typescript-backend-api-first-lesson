import type { Page } from '@playwright/test'

/** The languages of the applications */
export type Language = 'en' | 'ja'

/** Where the applications keep the language their visitor chose */
const KEPT_AT = 'beauty-salon:language'

/**
 * Opens the pages of a test as the browser of a visitor who chose a
 * language opens them: the choice is kept before a script of the page
 * runs. No application shows the control that chooses yet, so a test puts
 * the choice where the control will.
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
 * Chooses a language in a page that is open, as the control will: the
 * browser tells the other tabs of the application, not the page itself.
 */
export const chooseLanguage = (page: Page, language: Language): Promise<void> =>
  page.evaluate(
    ({ key, chosen }) => {
      localStorage.setItem(key, chosen)
    },
    { key: KEPT_AT, chosen: language },
  )
