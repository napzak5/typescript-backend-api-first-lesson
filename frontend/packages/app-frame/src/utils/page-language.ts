import { languageStore } from '@beauty-salon-frontend/io'

/**
 * Keeps what the document says its language is (`<html lang>`) in step
 * with the language of the page, from now on and whenever another one is
 * chosen, in this tab or in another: a screen reader reads the page in
 * that language, and the browser picks the typeface for it. Returns the
 * function that ends it; the document keeps the language it then says.
 */
export const keepLanguageOfTheDocument = (): (() => void) => {
  const say = (): void => {
    document.documentElement.lang = languageStore.read()
  }
  say()

  return languageStore.subscribe(say)
}
