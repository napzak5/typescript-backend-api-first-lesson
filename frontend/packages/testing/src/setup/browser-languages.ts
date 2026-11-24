/**
 * The languages the browser of a test is set to (`navigator.languages`),
 * which decide the language of a page whose visitor chose none. jsdom says
 * the English of the United States. The tests of the screens are written in
 * Japanese, as most who use the product read it, so the browser of every
 * test is set to the Japanese of Japan, as that of the browser tests is,
 * unless the test sets other languages, and that again in the next test.
 */
const LANGUAGES_OF_A_TEST: readonly string[] = ['ja-JP']

let languages = LANGUAGES_OF_A_TEST

export const installBrowserLanguages = (): void => {
  Object.defineProperty(navigator, 'languages', {
    configurable: true,
    get: () => languages,
  })
}

/**
 * Sets the browser of the test to these languages, the one it prefers
 * first first (`['en-US']`), and tells the page, as a browser does whose
 * settings change (`languagechange`). Call it before the component is
 * drawn, to draw it in a browser so set.
 */
export const setBrowserLanguages = (chosen: readonly string[]): void => {
  languages = chosen
  window.dispatchEvent(new Event('languagechange'))
}

/** Gives the next test the browser every test starts with */
export const resetBrowserLanguages = (): void => {
  if (languages !== LANGUAGES_OF_A_TEST) {
    setBrowserLanguages(LANGUAGES_OF_A_TEST)
  }
}
