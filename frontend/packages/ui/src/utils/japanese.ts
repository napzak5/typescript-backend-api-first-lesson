import { type LocalizedText, textIn } from '@beauty-salon-shared/i18n'

/*
 * The screens are written in every language one package at a time. Until
 * the last one is, a screen that still writes its texts in Japanese meets
 * what is written in every language already through these two functions.
 * They go when no screen needs them.
 */

/** A message as a screen that is written in Japanese alone shows it. */
export const inJapanese = (message: LocalizedText): string =>
  textIn(message, 'ja')

/**
 * A text of a screen that is written in Japanese alone, where a message is
 * asked for: it reads the same in every language.
 */
export const writtenInJapanese = (written: string): LocalizedText => ({
  en: written,
  ja: written,
})
