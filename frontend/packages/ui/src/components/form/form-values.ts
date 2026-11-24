import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { AnyFormErrors, FormErrors } from './error-focus'

/**
 * What a form was sent with: the value to send on, or what is wrong with
 * the values, under the names of their controls. A form that names its
 * controls in a type of its own gives that type of errors.
 */
export type FormRead<Value, Errors extends AnyFormErrors = FormErrors> =
  | { type: 'valid'; value: Value }
  | { type: 'invalid'; errors: Errors }

/**
 * What a form says about the last attempt: about the whole of it, and at
 * its controls. A form of a package whose texts are messages says messages
 * (`FormSays<LocalizedText>`), and the component that shows it says them in
 * the language of the page (`useSaidForm`).
 */
export type FormSays<Text = string> = {
  message: Text | undefined
  errors: FormErrors<Text>
}

/**
 * A form with nothing wrong at any control: one object, so that a form that
 * is given none renders the same. It is the errors of a form of either kind
 */
export const NO_ERRORS: FormErrors<never> = {}

/** What a form says before the first attempt, and after one there is nothing to say about: of either kind */
export const NOTHING_TO_SAY: FormSays<never> = {
  message: undefined,
  errors: NO_ERRORS,
}

/** What a form says about an attempt as a whole, with nothing at its controls */
export const aboutTheAttempt = <Text>(message: Text): FormSays<Text> => ({
  message,
  errors: {},
})

/**
 * What is said when a form is sent with the values it opened with: nothing
 * is sent. A message, which the notification says in the language of the
 * page
 */
export const NO_CHANGE_MESSAGE: LocalizedText = uiMessages.noChange

/** The text of a control of a form; nothing for one that is not there or holds a file. */
export const textOf = (values: FormData, name: string): string => {
  const value = values.get(name)

  return typeof value === 'string' ? value : ''
}

/**
 * The texts of the controls of a form that share a name, in their order:
 * the boxes of a group that are checked, the options of a select of more
 * than one. A file among them is none.
 */
export const textsOf = (values: FormData, name: string): string[] =>
  values
    .getAll(name)
    .flatMap((value) => (typeof value === 'string' ? [value] : []))

/** A text that was filled in, without the spaces around it; nothing, and only spaces, as `null`. */
export const textOrNull = (text: string | null): string | null => {
  const trimmed = (text ?? '').trim()

  return trimmed === '' ? null : trimmed
}

/** What is wrong with a control, as an entry of the errors under its name; none when nothing is. */
export const errorAt = <Text>(
  control: string,
  message: Text | undefined,
): [string, Text][] => (message === undefined ? [] : [[control, message]])

/**
 * Whether a form is sent with the values it opened with. The values are
 * plain data, as the API sends them and a form reads them back: the same
 * properties, in the same order.
 */
export const same = (one: unknown, other: unknown): boolean =>
  JSON.stringify(one) === JSON.stringify(other)
