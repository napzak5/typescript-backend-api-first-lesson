import {
  type Locale,
  type LocalizedText,
  textIn,
} from '@beauty-salon-shared/i18n'
import { match, P } from 'ts-pattern'

/**
 * A text of an error: written in every language, or, until every text the
 * domain writes is, in English alone.
 */
export type Told = string | LocalizedText

/**
 * A text of an error in a language. One that is written in English alone
 * is told in English, whatever the language.
 */
export const toldIn = (told: Told, language: Locale): string =>
  match(told)
    .with(P.string, (english) => english)
    .with(P.not(P.string), (written) => textIn(written, language))
    .exhaustive()

/** Whether a text of an error is written in every language. */
export const isToldInEveryLanguage = (told: Told): boolean =>
  match(told)
    .with(P.string, () => false)
    .with(P.not(P.string), () => true)
    .exhaustive()
