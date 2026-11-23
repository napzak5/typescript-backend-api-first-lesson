import { type LocalizedText, textIn } from '@beauty-salon-shared/i18n'

/*
 * The screens are written in every language one package at a time. Until
 * the last one is, a screen that still writes its texts in Japanese meets
 * what is written in every language already through these functions.
 * They go when no screen needs them.
 */

/** A message as a screen that is written in Japanese alone shows it. */
export const inJapanese = (message: LocalizedText): string =>
  textIn(message, 'ja')

/**
 * A message that may be none, as a screen that is written in Japanese
 * alone shows it: what a rule says of a value, which says nothing
 * (`undefined`) of a value that is right.
 */
export const inJapaneseIfAny = (
  message: LocalizedText | undefined,
): string | undefined =>
  message === undefined ? undefined : inJapanese(message)

/**
 * What a rule says of the values of a form, under the names of their
 * controls, as a screen that is written in Japanese alone shows it.
 */
export const errorsInJapanese = (
  errors: Readonly<Record<string, LocalizedText | undefined>>,
): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(errors).map(([control, message]) => [
      control,
      inJapaneseIfAny(message),
    ]),
  )

/**
 * A text of a screen that is written in Japanese alone, where a message is
 * asked for: it reads the same in every language.
 */
export const writtenInJapanese = (written: string): LocalizedText => ({
  en: written,
  ja: written,
})
