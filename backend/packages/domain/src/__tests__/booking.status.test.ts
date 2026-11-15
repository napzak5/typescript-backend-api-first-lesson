import { describe, expect, it } from 'vitest'
import {
  type BookingAction,
  type BookingInStatus,
  isCounted,
  planStatusChange,
  UNFINISHED_STATUSES,
} from '../business-logic/booking'
import { userIdSchema } from '../models/auth'
import type { BookingStatusWrite, DbBooking } from '../models/booking'
import { USER_ID } from './auth-fixtures'

type Status = DbBooking['status']

const STATUSES: Status[] = [
  'draft',
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]

const BY = userIdSchema.parse(USER_ID)

/** The time the booking was made for. */
const START = new Date('2026-11-20T01:00:00.000Z')

/** A moment after the booking has begun, at which the status is changed. */
const AT = new Date('2026-11-20T03:04:05.678Z')
const origin = { changedBy: BY, at: AT }

const booking = (
  overrides: Partial<BookingInStatus> = {},
): BookingInStatus => ({
  status: 'confirmed',
  startTime: START,
  actualStartTime: null,
  actualEndTime: null,
  ...overrides,
})

const noTimes = { actualStartTime: null, actualEndTime: null }

/** An action of each kind, the statuses it leads on from and the one it leads to. */
const ACTIONS: [BookingAction, Status[], Status][] = [
  [{ type: 'confirm' }, ['draft', 'pending'], 'confirmed'],
  [
    { type: 'cancel', cancellationReason: null },
    ['draft', 'pending', 'confirmed'],
    'cancelled',
  ],
  [{ type: 'start' }, ['confirmed'], 'in_progress'],
  [{ type: 'complete', ...noTimes }, ['confirmed', 'in_progress'], 'completed'],
  [{ type: 'noShow' }, ['pending', 'confirmed'], 'no_show'],
]

const TAKEN: [string, Status, Status, BookingAction][] = ACTIONS.flatMap(
  ([action, from, to]) =>
    from.map((status): [string, Status, Status, BookingAction] => [
      action.type,
      status,
      to,
      action,
    ]),
)

const REFUSED: [string, Status, BookingAction, Status[]][] = ACTIONS.flatMap(
  ([action, from]) =>
    STATUSES.filter((status) => !from.includes(status)).map(
      (status): [string, Status, BookingAction, Status[]] => [
        action.type,
        status,
        action,
        from,
      ],
    ),
)

/** What a plan writes; fails the test when the action was refused. */
const writeOf = (
  action: BookingAction,
  overrides: Partial<BookingInStatus> = {},
  at: Date = AT,
): BookingStatusWrite => {
  const plan = planStatusChange(booking(overrides), action, {
    changedBy: BY,
    at,
  })
  if (plan.type !== 'planned') {
    throw new Error(`Expected a plan, got ${JSON.stringify(plan)}`)
  }
  return plan.write
}

describe('isCounted', () => {
  it.each<Status>(['completed', 'cancelled', 'no_show'])(
    'counts a booking that is %s for its customer',
    (status) => {
      expect(isCounted(status)).toBe(true)
    },
  )

  it.each<Status>(['draft', 'pending', 'confirmed', 'in_progress'])(
    'does not count a booking that is %s',
    (status) => {
      expect(isCounted(status)).toBe(false)
    },
  )
})

describe('UNFINISHED_STATUSES', () => {
  it('names the statuses of a booking that is not finished', () => {
    expect(UNFINISHED_STATUSES).toEqual([
      'draft',
      'pending',
      'confirmed',
      'in_progress',
    ])
  })

  it.each(STATUSES)(
    'has %s exactly when an action leads on from it',
    (status) => {
      const leadsOn = ACTIONS.some(([, from]) => from.includes(status))

      expect(UNFINISHED_STATUSES.includes(status)).toBe(leadsOn)
    },
  )

  it.each(STATUSES)(
    'has %s exactly when a booking in it is not counted for its customer',
    (status) => {
      expect(UNFINISHED_STATUSES.includes(status)).toBe(!isCounted(status))
    },
  )
})

describe('planStatusChange', () => {
  it.each(TAKEN)(
    '%s leads a booking that is %s to %s, and notes the change for the history',
    (_name, from, to, action) => {
      const write = writeOf(action, { status: from })

      expect(write.booking.status).toBe(to)
      expect(write.statusChange).toStrictEqual({
        fromStatus: from,
        toStatus: to,
        changedBy: BY,
        reason: null,
        metadata: null,
      })
    },
  )

  it.each(REFUSED)(
    '%s does not lead on from %s, and says from where it does',
    (_name, status, action, from) => {
      expect(planStatusChange(booking({ status }), action, origin)).toEqual({
        type: 'statusDoesNotAllow',
        action: action.type,
        status,
        allowed: from,
      })
    },
  )

  it('covers every action and every status', () => {
    expect(TAKEN).toHaveLength(10)
    expect(REFUSED).toHaveLength(25)
  })

  describe('confirm', () => {
    it('writes the status and nothing else', () => {
      expect(writeOf({ type: 'confirm' }, { status: 'pending' })).toStrictEqual(
        {
          booking: { status: 'confirmed' },
          servicesCompletedAt: null,
          statusChange: expect.objectContaining({ toStatus: 'confirmed' }),
          countsCustomer: false,
        },
      )
    })
  })

  describe('cancel', () => {
    it('notes when, by whom and why, with a fee of 0, and counts the customer again', () => {
      const write = writeOf({
        type: 'cancel',
        cancellationReason: 'お客様のご都合',
      })

      expect(write).toStrictEqual({
        booking: {
          status: 'cancelled',
          cancelledAt: '2026-11-20T03:04:05.678Z',
          cancelledBy: BY,
          cancellationReason: 'お客様のご都合',
          cancellationFee: 0,
        },
        servicesCompletedAt: null,
        statusChange: {
          fromStatus: 'confirmed',
          toStatus: 'cancelled',
          changedBy: BY,
          reason: 'お客様のご都合',
          metadata: null,
        },
        countsCustomer: true,
      })
    })

    it('notes no reason when none is given', () => {
      const write = writeOf({ type: 'cancel', cancellationReason: null })

      expect(write.booking.cancellationReason).toBeNull()
      expect(write.statusChange.reason).toBeNull()
    })

    it('does not ask whether the booking has begun', () => {
      const cancel: BookingAction = { type: 'cancel', cancellationReason: null }

      expect(
        writeOf(cancel, {}, new Date('2026-11-19T00:00:00Z')).booking.status,
      ).toBe('cancelled')
      expect(
        writeOf(cancel, {}, new Date('2026-11-21T00:00:00Z')).booking.status,
      ).toBe('cancelled')
    })
  })

  describe('start', () => {
    it('notes the moment as the actual start, and leaves the customer as counted', () => {
      expect(writeOf({ type: 'start' })).toStrictEqual({
        booking: {
          status: 'in_progress',
          actualStartTime: '2026-11-20T03:04:05.678Z',
        },
        servicesCompletedAt: null,
        statusChange: expect.objectContaining({ toStatus: 'in_progress' }),
        countsCustomer: false,
      })
    })

    it('does not ask whether the time of the booking has come', () => {
      expect(
        writeOf({ type: 'start' }, {}, new Date('2026-11-20T00:30:00Z')).booking
          .status,
      ).toBe('in_progress')
    })
  })

  describe('complete', () => {
    it('notes the moment of the completion for the booking and its service lines, and counts the customer again', () => {
      expect(writeOf({ type: 'complete', ...noTimes })).toStrictEqual({
        booking: {
          status: 'completed',
          completedAt: '2026-11-20T03:04:05.678Z',
        },
        servicesCompletedAt: '2026-11-20T03:04:05.678Z',
        statusChange: expect.objectContaining({ toStatus: 'completed' }),
        countsCustomer: true,
      })
    })

    it('writes the actual times the request states', () => {
      const write = writeOf({
        type: 'complete',
        actualStartTime: '2026-11-20T01:02:00.000Z',
        actualEndTime: '2026-11-20T02:03:00.000Z',
      })

      expect(write.booking).toStrictEqual({
        status: 'completed',
        completedAt: '2026-11-20T03:04:05.678Z',
        actualStartTime: '2026-11-20T01:02:00.000Z',
        actualEndTime: '2026-11-20T02:03:00.000Z',
      })
    })

    it('leaves a time the request does not state as the booking has it: it does not write the column', () => {
      const began = new Date('2026-11-20T01:05:00.000Z')

      expect(
        writeOf(
          {
            type: 'complete',
            actualStartTime: null,
            actualEndTime: '2026-11-20T02:03:00.000Z',
          },
          { status: 'in_progress', actualStartTime: began },
        ).booking,
      ).toStrictEqual({
        status: 'completed',
        completedAt: '2026-11-20T03:04:05.678Z',
        actualEndTime: '2026-11-20T02:03:00.000Z',
      })
      expect(
        writeOf(
          {
            type: 'complete',
            actualStartTime: '2026-11-20T01:00:00.000Z',
            actualEndTime: null,
          },
          { status: 'in_progress', actualStartTime: began },
        ).booking,
      ).toStrictEqual({
        status: 'completed',
        completedAt: '2026-11-20T03:04:05.678Z',
        actualStartTime: '2026-11-20T01:00:00.000Z',
      })
    })

    it.each<[string, Partial<BookingInStatus>, BookingAction]>([
      [
        'an end that is the start the booking has',
        { actualStartTime: new Date('2026-11-20T01:05:00.000Z') },
        {
          type: 'complete',
          actualStartTime: null,
          actualEndTime: '2026-11-20T01:05:00.000Z',
        },
      ],
      [
        'an end before the start the booking has',
        { actualStartTime: new Date('2026-11-20T01:05:00.000Z') },
        {
          type: 'complete',
          actualStartTime: null,
          actualEndTime: '2026-11-20T01:04:59.999Z',
        },
      ],
      [
        'a start that is the end the booking has',
        { actualEndTime: new Date('2026-11-20T02:00:00.000Z') },
        {
          type: 'complete',
          actualStartTime: '2026-11-20T02:00:00.000Z',
          actualEndTime: null,
        },
      ],
      [
        'a start after the end the booking has',
        { actualEndTime: new Date('2026-11-20T02:00:00.000Z') },
        {
          type: 'complete',
          actualStartTime: '2026-11-20T02:00:00.001Z',
          actualEndTime: null,
        },
      ],
    ])('refuses %s', (_case, times, action) => {
      expect(planStatusChange(booking(times), action, origin)).toEqual({
        type: 'actualTimesOutOfOrder',
      })
    })

    it.each<[string, Partial<BookingInStatus>, BookingAction]>([
      [
        'an end a millisecond after the start the booking has',
        { actualStartTime: new Date('2026-11-20T01:05:00.000Z') },
        {
          type: 'complete',
          actualStartTime: null,
          actualEndTime: '2026-11-20T01:05:00.001Z',
        },
      ],
      [
        'a start a millisecond before the end the booking has',
        { actualEndTime: new Date('2026-11-20T02:00:00.000Z') },
        {
          type: 'complete',
          actualStartTime: '2026-11-20T01:59:59.999Z',
          actualEndTime: null,
        },
      ],
      [
        'an end before the start the booking has, with a start before that end',
        { actualStartTime: new Date('2026-11-20T01:05:00.000Z') },
        {
          type: 'complete',
          actualStartTime: '2026-11-20T00:50:00.000Z',
          actualEndTime: '2026-11-20T01:00:00.000Z',
        },
      ],
      [
        'no times, for a booking that has both',
        {
          actualStartTime: new Date('2026-11-20T01:05:00.000Z'),
          actualEndTime: new Date('2026-11-20T02:00:00.000Z'),
        },
        { type: 'complete', ...noTimes },
      ],
      [
        'no times, for a booking that has an end alone',
        { actualEndTime: new Date('2026-11-20T02:00:00.000Z') },
        { type: 'complete', ...noTimes },
      ],
    ])('takes %s', (_case, times, action) => {
      expect(writeOf(action, times).booking.status).toBe('completed')
    })

    it('does not ask whether the booking has begun', () => {
      expect(
        writeOf(
          { type: 'complete', ...noTimes },
          {},
          new Date('2026-11-20T00:30:00Z'),
        ).booking.status,
      ).toBe('completed')
    })
  })

  describe('noShow', () => {
    it('writes the status alone, and counts the customer again', () => {
      expect(writeOf({ type: 'noShow' })).toStrictEqual({
        booking: { status: 'no_show' },
        servicesCompletedAt: null,
        statusChange: expect.objectContaining({ toStatus: 'no_show' }),
        countsCustomer: true,
      })
    })

    it('is refused until the time the booking was made for has come', () => {
      const millisecondBefore = new Date(START.getTime() - 1)

      expect(
        planStatusChange(
          booking(),
          { type: 'noShow' },
          { changedBy: BY, at: millisecondBefore },
        ),
      ).toEqual({ type: 'notBegunYet' })
      expect(
        planStatusChange(
          booking({ status: 'pending' }),
          { type: 'noShow' },
          { changedBy: BY, at: new Date('2026-11-01T00:00:00Z') },
        ),
      ).toEqual({ type: 'notBegunYet' })
    })

    it('is taken from the moment the booking begins', () => {
      expect(writeOf({ type: 'noShow' }, {}, START).booking.status).toBe(
        'no_show',
      )
      expect(
        writeOf({ type: 'noShow' }, {}, new Date(START.getTime() + 1)).booking
          .status,
      ).toBe('no_show')
    })

    it('says that the status does not allow it before it says that the booking has not begun', () => {
      expect(
        planStatusChange(
          booking({ status: 'cancelled' }),
          { type: 'noShow' },
          { changedBy: BY, at: new Date('2026-11-01T00:00:00Z') },
        ),
      ).toMatchObject({ type: 'statusDoesNotAllow' })
    })
  })

  it('names the reason of a cancellation in the history, and no reason for any other change', () => {
    const reasons = ACTIONS.map(
      ([action, from]) =>
        writeOf(
          action.type === 'cancel'
            ? { type: 'cancel', cancellationReason: 'x' }
            : action,
          { status: from.at(-1) ?? 'confirmed' },
        ).statusChange.reason,
    )

    expect(reasons).toEqual([null, 'x', null, null, null])
  })
})
