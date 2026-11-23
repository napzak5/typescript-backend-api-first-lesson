import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { fieldMessages } from '@beauty-salon-shared/i18n/messages/ui'

/** What a form says of a value that is none of those it offers */
export const UNLISTED_MESSAGE: LocalizedText = fieldMessages.unlisted

/**
 * One of the values of a list, as a control holds it: nothing (`null`) for
 * a control left empty, `undefined` for a text that is none of them.
 */
export const choiceOf = <Value extends string>(
  values: readonly Value[],
  text: string,
): Value | null | undefined =>
  text === '' ? null : values.find((value) => value === text)
