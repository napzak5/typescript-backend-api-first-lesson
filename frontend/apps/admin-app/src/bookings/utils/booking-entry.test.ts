import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import type {
  BookingCreation,
  BookingRemoval,
  BookingUpdate,
  LineCheck,
} from '../api/bookings-api'
import { aBooking } from '../components/examples'
import {
  afterEntry,
  afterNotesChange,
  afterRemoval,
  checkedSaysOf,
  DEPOSIT_ERROR,
  entryChoiceIn,
  entryQueryOf,
  type Notes,
  type RemovalSays,
  readEntry,
  readLines,
  readNotes,
  readNotesChange,
  sourceNameOf,
  TAKEN,
} from './booking-entry'

const TODAY = '2026-11-20'
const TOKYO = 'Asia/Tokyo'
const MEMBER = '7c4a9e2b-1f3d-4b8a-9e6c-5d2f8a1b3c70'
const OTHER_MEMBER = '8d5b0f3c-2a4e-4c9b-8f7d-6e3a9b2c4d81'
const CUT = '9e6c1a4d-3b5f-4dac-9a8e-7f4b0c3d5e92'
const COLOR = 'af7d2b5e-4c6a-4ebd-8b9f-8a5c1d4e6fa3'

/** The values of the notes, empty unless they are given. */
const notesValues = (
  given: Partial<Record<keyof Notes, string>> = {},
): [string, string][] => [
  ['source', given.source ?? ''],
  ['depositAmount', given.depositAmount ?? ''],
  ['customerRequest', given.customerRequest ?? ''],
  ['internalNotes', given.internalNotes ?? ''],
]

/** The values of a form of a line each, as the form hands them over. */
const linesValues = (
  lines: [string, string, string, string][],
  { staffId = MEMBER, date = TODAY } = {},
): [string, string][] => [
  ['staffId', staffId],
  ['date', date],
  ...lines.flatMap(
    ([serviceId, member, startTime, notes], index): [string, string][] => [
      [`services.${index}.serviceId`, serviceId],
      [`services.${index}.staffId`, member],
      [`services.${index}.startTime`, startTime],
      [`services.${index}.notes`, notes],
    ],
  ),
]

describe('entryChoiceIn', () => {
  it('should read the day, the keyword and the customer of an address', () => {
    // Act
    const choice = entryChoiceIn(
      new URLSearchParams(
        'date=2026-12-01&search=%20%E5%B1%B1%E7%94%B0%20&customerId=%20abc%20',
      ),
      TODAY,
    )

    // Assert
    expect(choice).toEqual({
      date: '2026-12-01',
      search: '山田',
      customerId: 'abc',
    })
  })

  it.each([
    ['no day', ''],
    ['a day that is none', 'date=2026-02-30'],
    ['a day the API does not take', 'date=3000-01-01'],
    ['no day at all', 'date=tomorrow'],
  ])(
    'should take today for %s, and no keyword or customer that is blank',
    (_, query) => {
      // Act
      const choice = entryChoiceIn(
        new URLSearchParams(`${query}&search=%20&customerId=%20`),
        TODAY,
      )

      // Assert
      expect(choice).toEqual({
        date: TODAY,
        search: undefined,
        customerId: undefined,
      })
    },
  )
})

describe('entryQueryOf', () => {
  it('should keep the day, the keyword and the customer in one order', () => {
    // Act
    const query = entryQueryOf({
      customerId: 'abc',
      search: '山田 花子',
      date: TODAY,
    })

    // Assert
    expect(query.toString()).toBe(
      'date=2026-11-20&search=%E5%B1%B1%E7%94%B0+%E8%8A%B1%E5%AD%90&customerId=abc',
    )
  })

  it('should leave out what was not chosen', () => {
    // Act
    const query = entryQueryOf({
      date: TODAY,
      search: undefined,
      customerId: undefined,
    })

    // Assert
    expect(query.toString()).toBe('date=2026-11-20')
  })

  it('should give back what it was made from', () => {
    // Arrange
    const choice = { date: TODAY, search: '0901234', customerId: 'abc' }

    // Act
    const read = entryChoiceIn(entryQueryOf(choice), '2026-01-01')

    // Assert
    expect(read).toEqual(choice)
  })
})

describe('readLines', () => {
  it('should begin every line on the day of the visit, on the clock of the salon, in the order of the form', () => {
    // Act
    const read = readLines(
      formOfEntries(
        linesValues([
          [CUT, 'same', '10:00', ' 前髪は短めに '],
          [COLOR, OTHER_MEMBER, '11:30', ''],
          [CUT, 'none', '23:45', '   '],
        ]),
      ),
      TOKYO,
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        staffId: MEMBER,
        services: [
          {
            serviceId: CUT,
            staffId: MEMBER,
            startTime: '2026-11-20T01:00:00.000Z',
            notes: '前髪は短めに',
          },
          {
            serviceId: COLOR,
            staffId: OTHER_MEMBER,
            startTime: '2026-11-20T02:30:00.000Z',
            notes: null,
          },
          {
            serviceId: CUT,
            staffId: null,
            startTime: '2026-11-20T14:45:00.000Z',
            notes: null,
          },
        ],
      },
    })
  })

  it('should say at its control what each line lacks, with what the booking lacks', () => {
    // Act
    const read = readLines(
      formOfEntries(
        linesValues(
          [
            [CUT, 'same', '10:00', ''],
            ['', 'same', '', ''],
          ],
          { staffId: '', date: '' },
        ),
      ),
      TOKYO,
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        staffId: '担当スタッフを選んでください。',
        date: '来店日を入力してください。',
        'services.1.serviceId': 'メニューを選んでください。',
        'services.1.startTime': '開始の時刻を入力してください。',
      },
    })
  })

  it('should refuse a time the clock of the salon skips on the day', () => {
    // Act: New York moves from 2:00 to 3:00 on 8 March 2026
    const read = readLines(
      formOfEntries(
        linesValues([[CUT, 'same', '02:30', '']], { date: '2026-03-08' }),
      ),
      'America/New_York',
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        'services.0.startTime':
          'サロンの時計で、この日にない時刻です（夏時間の始まり）。別の時刻を入力してください。',
      },
    })
  })

  it('should read a time that comes twice on the day as the first', () => {
    // Act: New York moves from 2:00 back to 1:00 on 1 November 2026
    const read = readLines(
      formOfEntries(
        linesValues([[CUT, 'same', '01:30', '']], { date: '2026-11-01' }),
      ),
      'America/New_York',
    )

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: { services: [{ startTime: '2026-11-01T05:30:00.000Z' }] },
    })
  })
})

describe('readNotes', () => {
  it.each([
    ['digits', '3000', 3000],
    ['digits of full width and commas', '１，０００', 1000],
    ['blanks around the digits', ' 500 ', 500],
    ['nothing', '', null],
    ['zero', '0', 0],
    ['the largest amount', '2147483647', 2147483647],
  ])('should read a deposit of %s', (_, typed, depositAmount) => {
    // Act
    const read = readNotes(formOfEntries(notesValues({ depositAmount: typed })))

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        source: null,
        depositAmount,
        customerRequest: null,
        internalNotes: null,
      },
    })
  })

  it.each([
    ['a negative amount', '-500'],
    ['a fraction', '1.5'],
    ['words', '千円'],
    ['an amount larger than a booking holds', '2147483648'],
  ])('should refuse %s as a deposit', (_, typed) => {
    // Act
    const read = readNotes(formOfEntries(notesValues({ depositAmount: typed })))

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: { depositAmount: DEPOSIT_ERROR },
    })
  })

  it('should read the way and the notes without the blanks around them', () => {
    // Act
    const read = readNotes(
      formOfEntries(
        notesValues({
          source: 'phone',
          customerRequest: ' 短めに\n',
          internalNotes: '  初めてのお客様  ',
        }),
      ),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        source: 'phone',
        depositAmount: null,
        customerRequest: '短めに',
        internalNotes: '初めてのお客様',
      },
    })
  })
})

describe('readEntry', () => {
  it('should put the salon, the customer, the lines and the notes into one booking', () => {
    // Act
    const read = readEntry(
      formOfEntries([
        ...linesValues([[CUT, 'same', '10:00', '']]),
        ...notesValues({ source: 'walk_in', depositAmount: '1000' }),
      ]),
      { salonId: 'salon', customerId: 'customer', timezone: TOKYO },
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        salonId: 'salon',
        customerId: 'customer',
        staffId: MEMBER,
        services: [
          {
            serviceId: CUT,
            staffId: MEMBER,
            startTime: '2026-11-20T01:00:00.000Z',
            notes: null,
          },
        ],
        source: 'walk_in',
        depositAmount: 1000,
        customerRequest: null,
        internalNotes: null,
      },
    })
  })

  it('should say what is wrong with the lines and the notes at once', () => {
    // Act
    const read = readEntry(
      formOfEntries([
        ...linesValues([[CUT, 'same', '', '']]),
        ...notesValues({ depositAmount: '-1' }),
      ]),
      { salonId: 'salon', customerId: 'customer', timezone: TOKYO },
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        'services.0.startTime': '開始の時刻を入力してください。',
        depositAmount: DEPOSIT_ERROR,
      },
    })
  })
})

describe('readNotesChange', () => {
  const shown: Notes = {
    source: 'online',
    depositAmount: 3000,
    customerRequest: '根元を明るめに',
    internalNotes: null,
  }

  it('should ask for nothing when the form is sent as it was opened', () => {
    // Act
    const change = readNotesChange(
      formOfEntries(
        notesValues({
          source: 'online',
          depositAmount: '3,000',
          customerRequest: ' 根元を明るめに ',
        }),
      ),
      shown,
    )

    // Assert
    expect(change).toEqual({ type: 'unchanged' })
  })

  it('should ask for what was changed alone, and for null for what was emptied', () => {
    // Act
    const change = readNotesChange(
      formOfEntries(
        notesValues({
          source: 'phone',
          depositAmount: '3000',
          customerRequest: '',
          internalNotes: '次回はカラーも',
        }),
      ),
      shown,
    )

    // Assert
    expect(change).toEqual({
      type: 'valid',
      value: {
        source: 'phone',
        customerRequest: null,
        internalNotes: '次回はカラーも',
      },
    })
  })

  it('should take a note the booking holds with blanks around it for the same note', () => {
    // Act
    const change = readNotesChange(
      formOfEntries(notesValues({ internalNotes: 'メモ' })),
      {
        ...shown,
        source: null,
        depositAmount: null,
        customerRequest: null,
        internalNotes: ' メモ ',
      },
    )

    // Assert
    expect(change).toEqual({ type: 'unchanged' })
  })

  it('should refuse a deposit that is no amount, and ask for nothing', () => {
    // Act
    const change = readNotesChange(
      formOfEntries(notesValues({ depositAmount: 'abc' })),
      shown,
    )

    // Assert
    expect(change).toEqual({
      type: 'invalid',
      errors: { depositAmount: DEPOSIT_ERROR },
    })
  })
})

describe('sourceNameOf', () => {
  it.each([
    ['phone', '電話'],
    ['walk_in', '店頭'],
    ['email', 'メール'],
    ['other', 'その他'],
    ['online', 'オンライン'],
    ['fax', 'fax'],
  ])('should name the way %s', (source, name) => {
    // Act
    const named = sourceNameOf(source)

    // Assert
    expect(named).toBe(name)
  })
})

describe('afterEntry', () => {
  it('should say at their controls what the API refused, the first of a control, and about the attempt what has no control', () => {
    // Act
    const says = afterEntry({
      type: 'invalid',
      values: [
        { field: 'services.0.serviceId', rule: 'not_found' },
        { field: 'services.1.staffId', rule: 'not_found' },
        { field: 'depositAmount', rule: 'too_big' },
        { field: 'internalNotes', rule: 'too_big' },
        { field: 'customerId', rule: 'not_found' },
        { field: 'services.0.serviceId', rule: 'invalid_format' },
      ],
    })

    // Assert
    expect(says).toEqual({
      message:
        'このお客様は、台帳から削除されていました。お客様を選び直してください。',
      errors: {
        'services.0.serviceId':
          'このメニューは、もう選べません。選び直してください。',
        'services.1.staffId':
          'このスタッフは、もう選べません。選び直してください。',
        depositAmount: DEPOSIT_ERROR,
        internalNotes:
          'この値は受け付けられませんでした。入力を確かめてください。',
      },
    })
  })

  it('should say that a booking over the largest total cannot be put in', () => {
    // Act
    const says = afterEntry({
      type: 'invalid',
      values: [{ field: 'services', rule: 'custom' }],
    })

    // Assert
    expect(says).toEqual({
      message:
        '金額の合計が、1 件の予約で扱える上限を超えます。明細を減らしてください。',
      errors: {},
    })
  })

  it('should ask to check the values when what was refused is nothing the form knows', () => {
    // Act
    const says = afterEntry({
      type: 'invalid',
      values: [{ field: 'salonId', rule: 'invalid_format' }],
    })

    // Assert
    expect(says).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<[Exclude<BookingCreation['type'], 'created' | 'invalid'>, string]>([
    ['conflict', TAKEN],
    ['forbidden', 'このアカウントでは、このサロンの予約を入れられません。'],
    [
      'tooManyRequests',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'failed',
      '予約を入れられませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say what a refusal of %s is', (type, message) => {
    // Act
    const says = afterEntry({ type })

    // Assert
    expect(says).toEqual({ message, errors: {} })
  })
})

describe('afterNotesChange', () => {
  it('should say at the control of a note what the API refused, and nothing at a control the form has not', () => {
    // Act
    const says = afterNotesChange({
      type: 'invalid',
      values: [
        { field: 'customerRequest', rule: 'too_big' },
        { field: 'staffId', rule: 'not_found' },
      ],
    })

    // Assert
    expect(says).toEqual({
      message: undefined,
      errors: {
        customerRequest:
          'この値は受け付けられませんでした。入力を確かめてください。',
      },
    })
  })

  it.each<
    [Exclude<BookingUpdate['type'], 'updated' | 'notFound' | 'invalid'>, string]
  >([
    ['forbidden', 'このアカウントでは、この予約を変えられません。'],
    [
      'tooManyRequests',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'failed',
      '予約の記録を変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say what a refusal of %s is', (type, message) => {
    // Act
    const says = afterNotesChange({ type })

    // Assert
    expect(says).toEqual({ message, errors: {} })
  })
})

describe('afterRemoval', () => {
  it.each<[BookingRemoval, RemovalSays]>([
    [{ type: 'deleted' }, { type: 'done' }],
    [{ type: 'notFound' }, { type: 'gone' }],
    [
      { type: 'referred' },
      {
        type: 'refused',
        message:
          'この予約は、売上、施術記録、レビューのどれかが指しているため、削除できません。行われた来店の記録として残ります。',
      },
    ],
    [
      { type: 'forbidden' },
      {
        type: 'refused',
        message:
          'このアカウントでは、予約を削除できません。行われない予約は、キャンセルしてください。',
      },
    ],
    [
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      { type: 'failed' },
      {
        type: 'again',
        message:
          '予約を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should follow %o with %o', (outcome, says) => {
    // Act
    const followed = afterRemoval(outcome)

    // Assert
    expect(followed).toEqual(says)
  })
})

describe('checkedSaysOf', () => {
  const FREE: LineCheck = { type: 'free', overlapping: [] }
  const TAKEN_LINE: LineCheck = { type: 'taken', overlapping: [aBooking()] }
  const UNASSIGNED: LineCheck = { type: 'unassigned' }

  it.each<[string, LineCheck[], string]>([
    [
      'every member is free',
      [FREE, UNASSIGNED],
      '担当の空きを確かめました。重なる予約はありません。',
    ],
    [
      'members are taken',
      [TAKEN_LINE, FREE, TAKEN_LINE],
      '明細 1、3 の担当に、重なる予約があります。担当の前後の空け時間も、重なりに数えます。担当か開始の時刻を変えてください。',
    ],
    [
      'no line has a member',
      [UNASSIGNED, UNASSIGNED],
      '担当を決めた明細がありません。担当を決めない明細は、誰の時間も占有しません。',
    ],
    [
      'a member could not be checked',
      [TAKEN_LINE, { type: 'failed' }],
      '明細 2 の担当の空きを確かめられませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
    [
      'the API was asked too often',
      [{ type: 'failed' }, { type: 'tooManyRequests' }],
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
  ])('should say so when %s', (_, checks, said) => {
    // Act
    const says = checkedSaysOf(checks)

    // Assert
    expect(says).toBe(said)
  })
})
