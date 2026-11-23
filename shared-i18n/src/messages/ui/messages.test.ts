import { describe, expect, it } from 'vitest'
import { numberOf } from '../../formats/numbers'
import type { LocalizedText } from '../../languages/localized-text'
import { JAPANESE, messagesOf } from '../__tests__/found-messages'
import * as catalogues from './index'
import { answerMessages, fieldMessages, uiMessages } from './index'

const FOUND = messagesOf(catalogues, '')

const { counted, filterForm, pagedList, passwordField, rating } = uiMessages

/** A name a screen gives a control, or what it reads */
const SUPPLIER = { en: 'Supplier', ja: '仕入先' }
const BOOKINGS = { en: 'the bookings', ja: '予約' }

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
  [
    'fieldMessages.characters',
    fieldMessages.characters(255),
    { en: '255 characters', ja: '255 文字' },
  ],
  [
    'fieldMessages.tooLong',
    fieldMessages.tooLong(255),
    {
      en: 'Enter up to 255 characters.',
      ja: '255 文字以内で入力してください。',
    },
  ],
  [
    'fieldMessages.tooLongOf',
    fieldMessages.tooLongOf(SUPPLIER, 100),
    {
      en: 'Supplier: enter up to 100 characters.',
      ja: '仕入先は、100 文字以内で入力してください。',
    },
  ],
  [
    'fieldMessages.eachTooLongOf',
    fieldMessages.eachTooLongOf(SUPPLIER, 100),
    {
      en: 'Supplier: enter up to 100 characters for each entry.',
      ja: '仕入先は、1 つ 100 文字以内で入力してください。',
    },
  ],
  [
    'fieldMessages.neededWithin',
    fieldMessages.neededWithin(SUPPLIER, 100),
    {
      en: 'Supplier: enter 1 to 100 characters.',
      ja: '仕入先を、100 文字以内で入力してください。',
    },
  ],
  [
    'fieldMessages.upTo',
    fieldMessages.upTo(500),
    { en: 'Up to 500 characters.', ja: '500 文字まで。' },
  ],
  [
    'fieldMessages.notWebAddress',
    fieldMessages.notWebAddress(500),
    {
      en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
      ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
    },
  ],
  [
    'fieldMessages.webAddressDescription',
    fieldMessages.webAddressDescription(500),
    {
      en: 'A URL that begins with http:// or https://. Up to 500 characters.',
      ja: 'http:// か https:// で始まる URL。500 文字まで。',
    },
  ],
  [
    'fieldMessages.lineToCheck',
    fieldMessages.lineToCheck(2, fieldMessages.unlisted),
    {
      en: 'Check line 2. Choose one of the options.',
      ja: '2 行目を確かめてください。選択肢から選んでください。',
    },
  ],
  [
    'answerMessages.unread',
    answerMessages.unread(BOOKINGS),
    {
      en: 'Could not load the bookings. Check your connection and try again.',
      ja: '予約を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    },
  ],
]

describe('the messages of the shared parts of the screens', () => {
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
    [
      'a length',
      fieldMessages.tooLongOf(SUPPLIER, 2000),
      {
        en: 'Supplier: enter up to 2,000 characters.',
        ja: '仕入先は、2,000 文字以内で入力してください。',
      },
    ],
    [
      'a line',
      fieldMessages.lineToCheck(1200, fieldMessages.unlisted),
      {
        en: 'Check line 1,200. Choose one of the options.',
        ja: '1,200 行目を確かめてください。選択肢から選んでください。',
      },
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

  it('should count one character as one in English', () => {
    // Act
    const made = fieldMessages.upTo(1)

    // Assert
    expect(made).toEqual({ en: 'Up to 1 character.', ja: '1 文字まで。' })
  })

  it('should name no length of an address of the web where it may be of any', () => {
    // Act
    const made = fieldMessages.notWebAddress(null)

    // Assert
    expect(made).toEqual({
      en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com).',
      ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を入力してください。',
    })
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
