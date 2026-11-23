import { languageStore } from '@beauty-salon-frontend/io'
import { type LocalizedText, textIn } from '@beauty-salon-shared/i18n'

/**
 * What a component says for a message on the page as it is now. A play
 * function finds what it presses by the name it has in the language of the
 * page, so a story plays in whatever language the catalogue shows it in.
 */
export const saidOnThePage = (message: LocalizedText): string =>
  textIn(message, languageStore.read())
