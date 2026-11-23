import { describe, expect, it } from 'vitest'
import { numberOf } from '../../formats/numbers'
import type { LocalizedText } from '../../languages/localized-text'
import { JAPANESE, messagesOf } from '../__tests__/found-messages'
import * as catalogues from './index'
import { uiMessages } from './index'

const FOUND = messagesOf(catalogues, '')

const { counted, filterForm, pagedList, passwordField, rating } = uiMessages

/** A rating as the component writes it, to one decimal */
const ratingOf = (value: number): LocalizedText =>
  numberOf(value, { most: 1, least: 1 })

/** Every message that is made from a value, with a value and what it then says. */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'uiMessages.counted.items',
    counted.items(12),
    { en: '12 items', ja: '12 件' },
  ],
  [
    'uiMessages.counted.people',
    counted.people(12),
    { en: '12 people', ja: '12 人' },
  ],
  ['uiMessages.counted.rows', counted.rows(12), { en: '12 rows', ja: '12 行' }],
  [
    'uiMessages.filterForm.conditions',
    filterForm.conditions(2),
    { en: 'Filters (2)', ja: '条件（2）' },
  ],
  [
    'uiMessages.pagedList.shown',
    pagedList.shown(counted.items(20)),
    { en: 'Showing 20 items', ja: '20 件を表示しています' },
  ],
  [
    'uiMessages.pagedList.shownOf',
    pagedList.shownOf(counted.people(34), 20, counted.people(20)),
    { en: '34 people (showing 20)', ja: '34 人（20 人を表示しています）' },
  ],
  [
    'uiMessages.passwordField.show',
    passwordField.show('パスワード'),
    { en: 'Show パスワード', ja: 'パスワードを表示する' },
  ],
  [
    'uiMessages.rating.count',
    rating.count(128),
    { en: '(128 ratings)', ja: '（128 件）' },
  ],
  [
    'uiMessages.rating.outOf',
    rating.outOf(5, ratingOf(4.5), rating.count(128)),
    { en: '4.5 out of 5 (128 ratings)', ja: '5 段階中 4.5（128 件）' },
  ],
]

describe('the messages of the shared components', () => {
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

  it.each<[keyof typeof counted, LocalizedText]>([
    ['items', { en: '1 item', ja: '1 件' }],
    ['people', { en: '1 person', ja: '1 人' }],
    ['rows', { en: '1 row', ja: '1 行' }],
  ])(
    'should count one of the %s as one in English, and with the same word in Japanese',
    (word, expected) => {
      // Act
      const made = counted[word](1)

      // Assert
      expect(made).toEqual(expected)
    },
  )

  it.each<[number, LocalizedText]>([
    [0, { en: '0 items', ja: '0 件' }],
    [2, { en: '2 items', ja: '2 件' }],
  ])('should count %d of them as many in English', (count, expected) => {
    // Act
    const made = counted.items(count)

    // Assert
    expect(made).toEqual(expected)
  })

  it.each<[string, LocalizedText, LocalizedText]>([
    ['a count', counted.items(1234), { en: '1,234 items', ja: '1,234 件' }],
    [
      'a count of what is shown',
      pagedList.shownOf(counted.people(12345), 1234, counted.people(1234)),
      {
        en: '12,345 people (showing 1,234)',
        ja: '12,345 人（1,234 人を表示しています）',
      },
    ],
    [
      'the conditions',
      filterForm.conditions(1000),
      { en: 'Filters (1,000)', ja: '条件（1,000）' },
    ],
    [
      'the ratings of a mean',
      rating.count(1280),
      { en: '(1,280 ratings)', ja: '（1,280 件）' },
    ],
    [
      'a rating',
      rating.outOf(5, ratingOf(4.25), null),
      { en: '4.3 out of 5', ja: '5 段階中 4.3' },
    ],
  ])(
    'should write the numbers of %s with the format of numbers',
    (_what, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should name the button of the other conditions without a number while none narrows the list', () => {
    // Act
    const made = filterForm.conditions(0)

    // Assert
    expect(made).toEqual({ en: 'Filters', ja: '条件' })
  })

  it('should name the number of the other conditions from the first one that narrows the list', () => {
    // Act
    const made = filterForm.conditions(1)

    // Assert
    expect(made).toEqual({ en: 'Filters (1)', ja: '条件（1）' })
  })

  it('should put the label of a password inside the English sentence, beginning with a small letter', () => {
    // Act
    const made = passwordField.show('New password')

    // Assert
    expect(made.en).toBe('Show new password')
  })

  it('should count one rating as one in English', () => {
    // Act
    const made = rating.count(1)

    // Assert
    expect(made).toEqual({ en: '(1 rating)', ja: '（1 件）' })
  })

  it('should read a rating out without a count when it is the rating of one', () => {
    // Act
    const made = rating.outOf(5, ratingOf(4), null)

    // Assert
    expect(made).toEqual({ en: '4.0 out of 5', ja: '5 段階中 4.0' })
  })
})
