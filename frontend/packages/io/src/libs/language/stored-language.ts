import { LOCALES, type Locale } from '@beauty-salon-shared/i18n'
import { keptValue } from '../storage/kept-value'

const kept = keptValue('beauty-salon:language')

/** The language of a page whose visitor chose none. */
const DEFAULT_LANGUAGE: Locale = 'ja'

/**
 * The language of the page, as the browser keeps the choice of it: in
 * `localStorage`, so that it outlives a reload and is the same in every tab
 * of the application.
 */
export const languageStore = {
  /**
   * The language that was chosen. Japanese when none was, when what is kept
   * is no language of the product, and in a browser that refuses access to
   * its storage
   */
  read(): Locale {
    const chosen = kept.read()

    return LOCALES.find((language) => language === chosen) ?? DEFAULT_LANGUAGE
  },

  /**
   * Keeps the choice. Answers whether it is kept: a browser that lets the
   * site store nothing refuses, and the page stays as it is
   */
  choose(language: Locale): boolean {
    return kept.write(language)
  },

  /**
   * Calls the listener whenever the language may have changed, in this tab
   * or in another one. Returns the function that ends the subscription
   */
  subscribe: kept.subscribe,
}
