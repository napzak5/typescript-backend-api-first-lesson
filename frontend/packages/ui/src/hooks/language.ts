import { languageStore } from '@beauty-salon-frontend/io'
import { type LocalizedText, textIn } from '@beauty-salon-shared/i18n'
import { useCallback, useSyncExternalStore } from 'react'

/**
 * How a component says a text: `const say = useSay()`, then
 * `say(uiMessages.close)`. A text of a screen is a message, written in
 * every language, and it is said in the language of the page: the one its
 * visitor chose, in this tab or in another, and Japanese before anybody
 * chose. When another language is chosen, the component is drawn again
 * and says its texts anew.
 *
 * A message is said where it is shown. What is not a component (the rule
 * of a value, what a form makes of an answer) hands the message on, and
 * never a text of one language.
 */
export const useSay = (): ((message: LocalizedText) => string) => {
  const language = useSyncExternalStore(
    languageStore.subscribe,
    languageStore.read,
  )

  return useCallback(
    (message: LocalizedText) => textIn(message, language),
    [language],
  )
}
