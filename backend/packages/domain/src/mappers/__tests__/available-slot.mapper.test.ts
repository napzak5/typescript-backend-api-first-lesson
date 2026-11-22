import { describe, expect, it } from 'vitest'
import { DATE, jst } from '../../__tests__/fixtures/available-slot-fixtures'
import {
  BOOKING_ID,
  CUT_ID,
  OTHER_BOOKING_ID,
} from '../../__tests__/fixtures/booking-fixtures'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../__tests__/fixtures/staff-fixtures'
import { salonIdSchema } from '../../models/salon'
import {
  availableSlotCheckRequestSchema,
  availableSlotSearchRequestSchema,
} from '../../schemas/available-slot.schema'
import { AvailableSlotReadMapper } from '../read/available-slot.mapper'
import { AvailableSlotWriteMapper } from '../write/available-slot.mapper'

describe('AvailableSlotReadMapper.toApiAvailableSlot', () => {
  it('writes the times of a slot in UTC and keeps the staff member', () => {
    expect(
      AvailableSlotReadMapper.toApiAvailableSlot({
        staffId: STAFF_MEMBER_ID,
        startTime: jst('10:00'),
        endTime: jst('11:30'),
      }),
    ).toStrictEqual({
      staffId: STAFF_MEMBER_ID,
      startTime: '2026-11-16T01:00:00.000Z',
      endTime: '2026-11-16T02:30:00.000Z',
    })
  })

  it('writes a slot that ends on the next day in UTC', () => {
    expect(
      AvailableSlotReadMapper.toApiAvailableSlot({
        staffId: STAFF_MEMBER_ID,
        startTime: new Date('2026-11-16T23:30:00.000Z'),
        endTime: new Date('2026-11-17T00:30:00.000Z'),
      }),
    ).toStrictEqual({
      staffId: STAFF_MEMBER_ID,
      startTime: '2026-11-16T23:30:00.000Z',
      endTime: '2026-11-17T00:30:00.000Z',
    })
  })
})

describe('AvailableSlotReadMapper.toApiAvailableSlotPage', () => {
  const slots = [
    {
      staffId: STAFF_MEMBER_ID,
      startTime: jst('10:00'),
      endTime: jst('11:00'),
    },
    {
      staffId: OTHER_STAFF_MEMBER_ID,
      startTime: jst('10:30'),
      endTime: jst('11:30'),
    },
  ]

  it('answers with the slots in UTC, the counts of the list, and its last slot as the cursor of the page after it', () => {
    expect(
      AvailableSlotReadMapper.toApiAvailableSlotPage(
        slots,
        { total: 9, hasMore: true },
        { limit: 2, after: `2026-11-16T00:30:00.000Z_${STAFF_MEMBER_ID}` },
      ),
    ).toStrictEqual({
      data: [
        {
          staffId: STAFF_MEMBER_ID,
          startTime: '2026-11-16T01:00:00.000Z',
          endTime: '2026-11-16T02:00:00.000Z',
        },
        {
          staffId: OTHER_STAFF_MEMBER_ID,
          startTime: '2026-11-16T01:30:00.000Z',
          endTime: '2026-11-16T02:30:00.000Z',
        },
      ],
      meta: {
        total: 9,
        limit: 2,
        hasMore: true,
        cursor: `2026-11-16T00:30:00.000Z_${STAFF_MEMBER_ID}`,
        nextCursor: `2026-11-16T01:30:00.000Z_${OTHER_STAFF_MEMBER_ID}`,
        prevCursor: null,
      },
    })
  })

  it('names no next page when the slots end with this page', () => {
    expect(
      AvailableSlotReadMapper.toApiAvailableSlotPage(
        slots,
        { total: 2, hasMore: false },
        { limit: 20, after: null },
      ).meta,
    ).toStrictEqual({
      total: 2,
      limit: 20,
      hasMore: false,
      cursor: null,
      nextCursor: null,
      prevCursor: null,
    })
  })

  it('answers a day without slots with an empty page that names no next one', () => {
    expect(
      AvailableSlotReadMapper.toApiAvailableSlotPage(
        [],
        { total: 0, hasMore: false },
        { limit: 20, after: null },
      ),
    ).toStrictEqual({
      data: [],
      meta: {
        total: 0,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      },
    })
  })
})

describe('AvailableSlotReadMapper.toApiCheck', () => {
  it.each<[string, boolean, string[]]>([
    ['a free time', true, []],
    ['a time that is taken', false, [BOOKING_ID, OTHER_BOOKING_ID]],
    [
      'a free time of a staff member who takes more than one booking',
      true,
      [BOOKING_ID],
    ],
  ])(
    'answers %s with whether it is available and the bookings in the way',
    (_named, isAvailable, conflicts) => {
      expect(
        AvailableSlotReadMapper.toApiCheck(isAvailable, conflicts),
      ).toStrictEqual({ isAvailable, conflicts })
    },
  )
})

describe('AvailableSlotWriteMapper', () => {
  const salonId = salonIdSchema.parse(SALON_ID)

  it('asks for the first 20 slots of the day for every staff member, as long as the service takes, when the request names no more', () => {
    expect(
      AvailableSlotWriteMapper.fromSearchRequest(
        availableSlotSearchRequestSchema.parse({
          serviceId: CUT_ID,
          date: DATE,
        }),
        salonId,
      ),
    ).toStrictEqual({
      limit: 20,
      after: null,
      day: { salonId: SALON_ID, serviceId: CUT_ID, staffId: null, date: DATE },
      duration: null,
    })
  })

  it('takes the staff member, the duration and the place of the page the request names', () => {
    const cursor = `2026-11-16T01:00:00.000Z_${STAFF_MEMBER_ID}`

    expect(
      AvailableSlotWriteMapper.fromSearchRequest(
        availableSlotSearchRequestSchema.parse({
          limit: 5,
          cursor,
          staffId: STAFF_MEMBER_ID,
          serviceId: CUT_ID,
          date: DATE,
          duration: 45,
        }),
        salonId,
      ),
    ).toStrictEqual({
      limit: 5,
      after: cursor,
      day: {
        salonId: SALON_ID,
        serviceId: CUT_ID,
        staffId: STAFF_MEMBER_ID,
        date: DATE,
      },
      duration: 45,
    })
  })

  it('asks the ledger of the salon of the path about the staff member, the service and the moment of a check request', () => {
    expect(
      AvailableSlotWriteMapper.fromCheckRequest(
        availableSlotCheckRequestSchema.parse({
          staffId: STAFF_MEMBER_ID,
          serviceId: CUT_ID,
          startTime: '2026-11-16T01:00:00Z',
        }),
        salonId,
      ),
    ).toStrictEqual({
      salonId: SALON_ID,
      serviceId: CUT_ID,
      staffId: STAFF_MEMBER_ID,
      startTime: new Date('2026-11-16T01:00:00.000Z'),
    })
  })
})
