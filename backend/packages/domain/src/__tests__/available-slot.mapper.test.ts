import { describe, expect, it } from 'vitest'
import { AvailableSlotReadMapper } from '../mappers/read/available-slot.mapper'
import { jst } from './available-slot-fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

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
