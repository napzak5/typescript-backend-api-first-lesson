import {
  LOCALES,
  type Locale,
  localeOfLanguages,
} from '@beauty-salon-shared/i18n'
import { keptValue } from '../storage/kept-value'

const kept = keptValue('beauty-salon:language')

/** The language of a page whose visitor chose none, and whose browser is set to no language of the product. */
const DEFAULT_LANGUAGE: Locale = 'ja'

type Listener = () => void

/** Who hears of a choice that the browser would not keep */
const listeners = new Set<Listener>()

/**
 * A choice that the browser would not keep: the page says its texts in that
 * language until it is loaded again
 */
let chosenOnThisPage: Locale | undefined

/** The language that is kept: none when nothing is, or what is kept is no language of the product */
const keptLanguage = (): Locale | undefined => {
  const chosen = kept.read()

  return LOCALES.find((language) => language === chosen)
}

/**
 * The language of the page, as the browser keeps the choice of it: in
 * `localStorage`, so that it outlives a reload and is the same in every tab
 * of the application.
 */
export const languageStore = {
  /**
   * The language that was chosen. Without a choice, the language the
   * browser is set to, the one it prefers first that the product is written
   * in, and Japanese when it is set to none of them. What is kept that is no
   * language of the product is no choice, and a browser that refuses access
   * to its storage keeps none
   */
  read(): Locale {
    return (
      chosenOnThisPage ??
      keptLanguage() ??
      localeOfLanguages(navigator.languages, DEFAULT_LANGUAGE)
    )
  },

  /**
   * Keeps the choice. Answers whether it is kept: a browser that lets the
   * site store nothing refuses, and the page is in that language still,
   * until it is loaded again
   */
  choose(language: Locale): boolean {
    if (kept.write(language)) {
      chosenOnThisPage = undefined

      return true
    }
    chosenOnThisPage = language
    for (const listener of listeners) {
      listener()
    }

    return false
  },

  /**
   * Calls the listener whenever the language may have changed: a choice in
   * this tab or in another one, and a change of the languages of the
   * browser. Returns the function that ends the subscription
   */
  subscribe(listener: Listener): () => void {
    const unsubscribe = kept.subscribe(listener)
    listeners.add(listener)
    window.addEventListener('languagechange', listener)

    return () => {
      unsubscribe()
      listeners.delete(listener)
      window.removeEventListener('languagechange', listener)
    }
  },
}
