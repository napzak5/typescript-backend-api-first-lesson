import type { LocalizedText } from '../../languages/localized-text'

/** A letter of Japanese: a kana or a kanji */
export const JAPANESE = /[぀-ヿ一-鿿]/

export type Found = { texts: [string, LocalizedText][]; made: string[] }

/**
 * The messages of a catalogue, by where they are in it: those that are
 * written out, and the names of those that are made from a value.
 */
export const messagesOf = (value: unknown, where: string): Found => {
  if (typeof value === 'function') {
    return { texts: [], made: [where] }
  }
  if (typeof value !== 'object' || value === null) {
    return { texts: [], made: [] }
  }
  if (
    'en' in value &&
    'ja' in value &&
    typeof value.en === 'string' &&
    typeof value.ja === 'string'
  ) {
    return { texts: [[where, { en: value.en, ja: value.ja }]], made: [] }
  }

  const inside = Object.entries(value).map(([key, inner]) =>
    messagesOf(inner, where === '' ? key : `${where}.${key}`),
  )

  return {
    texts: inside.flatMap(({ texts }) => texts),
    made: inside.flatMap(({ made }) => made),
  }
}
