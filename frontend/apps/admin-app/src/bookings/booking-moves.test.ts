import type {
  ModelsBookingResponse,
  ModelsBookingStatusType,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  ADDITION_TAKEN,
  type AdditionAttempt,
  afterAddition,
  afterLineRemoval,
  afterMove,
  isMovable,
  type LineRemovalAttempt,
  type LineRemovalSays,
  lineRequestOf,
  MOVE_TAKEN,
  type MoveAttempt,
  mayAddLine,
  mayRemoveLine,
  movedLines,
  readAddition,
  readMove,
  whyLineStays,
  whyNoLineAdded,
  whyUnmovable,
} from './booking-moves'
import { aBooking, moment } from './components/examples'

const TOKYO = 'Asia/Tokyo'
const MEMBER = '7c4a9e2b-1f3d-4b8a-9e6c-5d2f8a1b3c70'
const OTHER_MEMBER = '8d5b0f3c-2a4e-4c9b-8f7d-6e3a9b2c4d81'
const THIRD_MEMBER = '5a3e8c1f-0b2d-4f6a-8c9e-4d1b7a0c2e53'
const CUT = '9e6c1a4d-3b5f-4dac-9a8e-7f4b0c3d5e92'
const COLOR = 'af7d2b5e-4c6a-4ebd-8b9f-8a5c1d4e6fa3'

const valuesOf = (entries: [string, string][]): FormData => {
  const values = new FormData()
  for (const [name, value] of entries) {
    values.append(name, value)
  }

  return values
}

type Line = ModelsBookingResponse['services'][number]

const [first] = aBooking().services

/** A line of the example booking, changed. */
const aLine = (changes: Partial<Line>): Line => ({
  id: '',
  serviceId: CUT,
  staffId: MEMBER,
  startTime: moment(0),
  endTime: moment(60),
  duration: 60,
  price: 5500,
  discountAmount: 0,
  finalPrice: 5500,
  taxIncluded: true,
  isCompleted: false,
  completedAt: null,
  notes: null,
  sortOrder: 0,
  ...first,
  ...changes,
})

/** A booking of the member, with as many lines as it is given. */
const withLines = (
  count: number,
  status: ModelsBookingStatusType = 'confirmed',
): ModelsBookingResponse =>
  aBooking({
    status,
    services: Array.from({ length: count }, (_, index) =>
      aLine({ id: `line-${index}`, sortOrder: index }),
    ),
  })

describe('the rules of a booking that is changed', () => {
  it.each<[ModelsBookingStatusType, boolean, boolean]>([
    ['draft', true, true],
    ['pending', true, true],
    ['confirmed', true, true],
    ['in_progress', false, true],
    ['completed', false, false],
    ['cancelled', false, false],
    ['no_show', false, false],
  ])(
    'should move a booking that is %s: %s; change its lines: %s',
    (status, moved, changed) => {
      // Arrange
      const booking = withLines(2, status)

      // Act, Assert
      expect(isMovable(booking)).toBe(moved)
      expect(mayAddLine(booking)).toBe(changed)
      expect(mayRemoveLine(booking)).toBe(changed)
    },
  )

  it('should add no 21st line, and take away no last one', () => {
    // Act, Assert
    expect(mayAddLine(withLines(19))).toBe(true)
    expect(mayAddLine(withLines(20))).toBe(false)
    expect(mayRemoveLine(withLines(2))).toBe(true)
    expect(mayRemoveLine(withLines(1))).toBe(false)
  })

  it('should say why a booking is not moved, by its state', () => {
    // Act, Assert
    expect(whyUnmovable(withLines(1))).toBeUndefined()
    expect(whyUnmovable(withLines(1, 'in_progress'))).toBe(
      'この予約は施術中のため、日時と担当を変えられません。日時と担当を変えられるのは、下書き、確定待ち、確定の予約です。',
    )
  })

  it('should say why no line is added: the state, or the most lines', () => {
    // Act, Assert
    expect(whyNoLineAdded(withLines(1, 'in_progress'))).toBeUndefined()
    expect(whyNoLineAdded(withLines(1, 'completed'))).toBe(
      'この予約は完了のため、施術明細を足せません。施術明細を変えられるのは、下書き、確定待ち、確定、施術中の予約です。',
    )
    expect(whyNoLineAdded(withLines(20))).toBe(
      '施術明細は 20 件までです。この予約には、もう足せません。',
    )
  })

  it('should say why a line stays: the state, or that it is the last', () => {
    // Act, Assert
    expect(whyLineStays(withLines(2))).toBeUndefined()
    expect(whyLineStays(withLines(2, 'cancelled'))).toBe(
      'この予約はキャンセルのため、施術明細を外せません。',
    )
    expect(whyLineStays(withLines(1))).toBe(
      '予約に残る最後の明細は、外せません。行われない来店は、予約をキャンセルしてください。',
    )
  })
})

describe('movedLines', () => {
  const booking = aBooking({
    staffId: MEMBER,
    startTime: moment(0),
    services: [
      aLine({
        id: 'second',
        serviceId: COLOR,
        staffId: OTHER_MEMBER,
        startTime: moment(60),
        endTime: moment(150),
        sortOrder: 1,
      }),
      aLine({ id: 'first', staffId: MEMBER, sortOrder: 0 }),
      aLine({
        id: 'third',
        staffId: null,
        startTime: moment(150),
        endTime: moment(180),
        sortOrder: 2,
      }),
    ],
  })

  it('should move every line as far as the beginning, in their order, and give the lines of the member to the new one', () => {
    // Act
    const moved = movedLines(booking, {
      startTime: moment(90),
      staffId: THIRD_MEMBER,
    })

    // Assert
    expect(
      moved.map(({ id, staffId, startTime, endTime }) => [
        id,
        staffId,
        startTime,
        endTime,
      ]),
    ).toEqual([
      ['first', THIRD_MEMBER, moment(90), moment(150)],
      ['second', OTHER_MEMBER, moment(150), moment(240)],
      ['third', null, moment(240), moment(270)],
    ])
  })

  it('should move nothing to where the booking is', () => {
    // Act
    const moved = movedLines(booking, {
      startTime: booking.startTime,
      staffId: booking.staffId,
    })

    // Assert
    expect(moved.map(({ id }) => id)).toEqual(['first', 'second', 'third'])
    expect(moved.map(({ startTime }) => startTime)).toEqual([
      moment(0),
      moment(60),
      moment(150),
    ])
  })

  it('should name a line as a request does, to check its member', () => {
    // Act, Assert
    expect(
      lineRequestOf(aLine({ notes: '根元だけ', staffId: OTHER_MEMBER })),
    ).toEqual({
      serviceId: CUT,
      staffId: OTHER_MEMBER,
      startTime: moment(0),
      notes: '根元だけ',
    })
  })
})

describe('readMove', () => {
  it('should read the member and the beginning on the clock of the salon', () => {
    // Act
    const read = readMove(
      valuesOf([
        ['staffId', OTHER_MEMBER],
        ['date', '2026-11-21'],
        ['startTime', '11:30'],
      ]),
      TOKYO,
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        staffId: OTHER_MEMBER,
        startTime: '2026-11-21T02:30:00.000Z',
      },
    })
  })

  it('should say at its control what each value lacks', () => {
    // Act
    const read = readMove(
      valuesOf([
        ['staffId', ''],
        ['date', ''],
        ['startTime', ''],
      ]),
      TOKYO,
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        staffId: '担当スタッフを選んでください。',
        date: '来店日を入力してください。',
        startTime: '開始の時刻を入力してください。',
      },
    })
  })

  it('should refuse a time the clock of the salon skips on the day', () => {
    // Act: New York moves from 2:00 to 3:00 on 8 March 2026
    const read = readMove(
      valuesOf([
        ['staffId', MEMBER],
        ['date', '2026-03-08'],
        ['startTime', '02:30'],
      ]),
      'America/New_York',
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        startTime:
          'サロンの時計で、この日にない時刻です（夏時間の始まり）。別の時刻を入力してください。',
      },
    })
  })
})

describe('readAddition', () => {
  const booking = aBooking({
    staffId: MEMBER,
    bookingDate: '2026-11-20',
    services: [aLine({ startTime: '2026-11-20T01:00:00.000Z' })],
  })

  const lineValues = (startTime: string, staffId = 'same'): FormData =>
    valuesOf([
      ['serviceId', COLOR],
      ['staffId', staffId],
      ['startTime', startTime],
      ['notes', ' 根元だけ '],
    ])

  it('should begin the line on the day of the visit, with the member of the booking for the same', () => {
    // Act
    const read = readAddition(lineValues('11:00'), { booking, timezone: TOKYO })

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        serviceId: COLOR,
        staffId: MEMBER,
        startTime: '2026-11-20T02:00:00.000Z',
        notes: '根元だけ',
      },
    })
  })

  it('should send no member for a line nobody does', () => {
    // Act
    const read = readAddition(lineValues('11:00', 'none'), {
      booking,
      timezone: TOKYO,
    })

    // Assert
    expect(read).toMatchObject({ type: 'valid', value: { staffId: null } })
  })

  it('should say at its control what the line lacks', () => {
    // Act
    const read = readAddition(
      valuesOf([
        ['serviceId', ''],
        ['staffId', 'same'],
        ['startTime', ''],
        ['notes', ''],
      ]),
      { booking, timezone: TOKYO },
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        serviceId: 'メニューを選んでください。',
        startTime: '開始の時刻を入力してください。',
      },
    })
  })

  it('should refuse a line that begins more than a day after the first, which a day of 25 hours holds', () => {
    // Arrange: New York moves from 2:00 back to 1:00 on 1 November 2026, and the first line begins at 00:15
    const long = aBooking({
      bookingDate: '2026-11-01',
      services: [aLine({ startTime: '2026-11-01T04:15:00.000Z' })],
    })
    const timezone = 'America/New_York'

    // Act
    const aDayAfter = readAddition(lineValues('23:15'), {
      booking: long,
      timezone,
    })
    const beyond = readAddition(lineValues('23:16'), {
      booking: long,
      timezone,
    })

    // Assert
    expect(aDayAfter).toMatchObject({
      type: 'valid',
      value: { startTime: '2026-11-02T04:15:00.000Z' },
    })
    expect(beyond).toEqual({
      type: 'invalid',
      errors: {
        startTime:
          'すべての明細は、最も早い明細の開始から 24 時間以内に始まります。開始の時刻を確かめてください。',
      },
    })
  })
})

describe('afterMove', () => {
  it.each<
    [
      string,
      Exclude<MoveAttempt, { type: 'moved' | 'unmovable' | 'notFound' }>,
      string | undefined,
      Record<string, string>,
    ]
  >([
    [
      'a member that is not the salon’s at its control',
      { type: 'invalid', values: [{ field: 'staffId', rule: 'not_found' }] },
      undefined,
      { staffId: 'このスタッフは、もう選べません。選び直してください。' },
    ],
    ['a member that is taken', { type: 'taken', checks: [] }, MOVE_TAKEN, {}],
    [
      'an account that may not',
      { type: 'forbidden' },
      'このアカウントでは、この予約を変えられません。',
      {},
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      {},
    ],
    [
      'a failure',
      { type: 'failed' },
      '予約の日時と担当を変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
      {},
    ],
  ])('should say what follows %s', (_case, outcome, message, errors) => {
    // Act, Assert
    expect(afterMove(outcome)).toEqual({ message, errors })
  })
})

describe('afterAddition', () => {
  it.each<
    [
      string,
      Exclude<AdditionAttempt, { type: 'added' | 'unaddable' | 'notFound' }>,
      string | undefined,
      Record<string, string>,
    ]
  >([
    [
      'a service that is not the salon’s at its control',
      { type: 'invalid', values: [{ field: 'serviceId', rule: 'not_found' }] },
      undefined,
      { serviceId: 'このメニューは、もう選べません。選び直してください。' },
    ],
    [
      'a member that is taken',
      { type: 'taken', check: { type: 'taken', overlapping: [] } },
      ADDITION_TAKEN,
      {},
    ],
    [
      'amounts beyond what a booking holds',
      { type: 'tooMuch' },
      '金額の合計が、1 件の予約で扱える上限を超えるため、施術明細を足せませんでした。',
      {},
    ],
    [
      'a failure',
      { type: 'failed' },
      '施術明細を足せませんでした。通信の状態を確かめて、もう一度お試しください。',
      {},
    ],
  ])('should say what follows %s', (_case, outcome, message, errors) => {
    // Act, Assert
    expect(afterAddition(outcome)).toEqual({ message, errors })
  })
})

describe('afterLineRemoval', () => {
  const now = withLines(1)

  it.each<[string, LineRemovalAttempt, LineRemovalSays]>([
    ['a removal', { type: 'deleted' }, { type: 'done' }],
    [
      'a line that stays',
      { type: 'refused', booking: now },
      { type: 'stays', booking: now },
    ],
    [
      'a booking that could not be summed up',
      { type: 'unsummed' },
      {
        type: 'again',
        message:
          '施術明細を外せませんでした。この明細を外すと、予約の金額を算出し直せません。',
      },
    ],
    ['a line that was gone', { type: 'notFound' }, { type: 'gone' }],
    [
      'an account that may not',
      { type: 'forbidden' },
      {
        type: 'again',
        message: 'このアカウントでは、この予約を変えられません。',
      },
    ],
    [
      'a failure',
      { type: 'failed' },
      {
        type: 'again',
        message:
          '施術明細を外せませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what follows %s', (_case, outcome, said) => {
    // Act, Assert
    expect(afterLineRemoval(outcome)).toEqual(said)
  })
})
