import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import * as catalogues from './index'
import { problemMessages, ruleMessages, salonMessages } from './index'

const JAPANESE = /[぀-ヿ一-鿿]/

type Found = { texts: [string, LocalizedText][]; made: string[] }

/**
 * The messages of a catalogue, by where they are in it: those that are
 * written out, and the names of those that are made from a value.
 */
const messagesOf = (value: unknown, where: string): Found => {
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

const FOUND = messagesOf(catalogues, '')

/** Every message that is made from a value, with a value and what it then says. */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'problemMessages.routeNotFound.detail',
    problemMessages.routeNotFound.detail('PUT', '/api/v1/salons'),
    {
      en: 'PUT /api/v1/salons is not part of the API',
      ja: 'PUT /api/v1/salons は、この API にありません',
    },
  ],
  [
    'problemMessages.bodyTooLarge.detail',
    problemMessages.bodyTooLarge.detail(100_000),
    {
      en: 'The request body exceeds 100000 bytes',
      ja: 'リクエストの本文が 100000 バイトを超えています',
    },
  ],
  [
    'ruleMessages.phoneDigits',
    ruleMessages.phoneDigits(10),
    {
      en: 'Must contain at least 10 digits',
      ja: '数字を 10 桁以上含めてください',
    },
  ],
  [
    'ruleMessages.laterThan',
    ruleMessages.laterThan('openTime'),
    {
      en: 'Must be later than openTime',
      ja: 'openTime より後にしてください',
    },
  ],
  [
    'ruleMessages.notEarlierThan',
    ruleMessages.notEarlierThan('startDate'),
    {
      en: 'Must not be earlier than startDate',
      ja: 'startDate より前にはできません',
    },
  ],
  [
    'ruleMessages.notLaterThan',
    ruleMessages.notLaterThan('2999-12-31'),
    {
      en: 'Must not be later than 2999-12-31',
      ja: '2999-12-31 より後にはできません',
    },
  ],
  [
    'ruleMessages.notNullWhenGiven',
    ruleMessages.notNullWhenGiven('referenceId'),
    {
      en: 'Must not be null when referenceId is given',
      ja: 'referenceId を指定するときは、null にできません',
    },
  ],
  [
    'salonMessages.dayOfWeekOf',
    salonMessages.dayOfWeekOf('2026-11-23'),
    {
      en: 'Must be the day of the week of 2026-11-23',
      ja: '2026-11-23 の曜日にしてください',
    },
  ],
]

describe('the messages of the API', () => {
  it.each(FOUND.texts)(
    'should be written in each language: %s',
    (_where, written) => {
      // Assert
      expect(written.en).toMatch(/^[A-Z]/)
      expect(written.en).not.toMatch(JAPANESE)
      expect(written.ja).toMatch(JAPANESE)
    },
  )

  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      FOUND.made.toSorted(),
    )
  })
})
