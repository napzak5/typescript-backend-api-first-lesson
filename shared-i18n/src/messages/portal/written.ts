import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'

/*
 * How the catalogues of the portal write what more than one of them
 * writes: a count, the parts of a line, a list and a postal code.
 */

/** How many there are, as English names one and many: 「1 review」, 「2 reviews」 */
export const countedIn = (count: number, one: string, many: string): string =>
  `${numberOf(count).en} ${count === 1 ? one : many}`

/**
 * The parts of a sentence that are joined with `join`, each as its
 * language writes it: what a salon or a customer wrote stands as it is in
 * both
 */
export const joined = (
  parts: readonly (string | LocalizedText)[],
  join: LocalizedText,
): LocalizedText =>
  text({
    en: parts
      .map((part) => (typeof part === 'string' ? part : part.en))
      .join(join.en),
    ja: parts
      .map((part) => (typeof part === 'string' ? part : part.ja))
      .join(join.ja),
  })

/** The entries of a list, as a sentence lists them: 「カット、カラー」, "Cut, Color" */
export const listed = (
  entries: readonly (string | LocalizedText)[],
): LocalizedText => joined(entries, { en: ', ', ja: '、' })

/** A postal code: 「〒150-0001」 */
export const postalCodeOf = (code: string): LocalizedText =>
  text({ en: code, ja: `〒${code}` })
