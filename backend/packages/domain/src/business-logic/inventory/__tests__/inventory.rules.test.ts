import { describe, expect, it } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import { OTHER_SALON_ID, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import type { Actor } from '../../../models/auth'
import { lotNumberRefusal } from '..'
import {
  inventoryKeeperReachOf,
  inventoryReachOf,
} from '../_shared/authorization'
import { lastExpiringDayOf } from '../_shared/expiry'

describe('lotNumberRefusal', () => {
  it.each<[string, boolean, string | null, string | null]>([
    ['a lot of a product kept by lots', true, 'LOT-1', null],
    ['no lot of a product that is not', false, null, null],
    [
      'no lot of a product kept by lots',
      true,
      null,
      'Must name the lot: the product is kept by lots',
    ],
    [
      'a lot of a product that is not',
      false,
      'LOT-1',
      'Must be null: the product is not kept by lots',
    ],
  ])('answers %s', (_case, requiresLotTracking, lotNumber, refusal) => {
    expect(lotNumberRefusal(requiresLotTracking, lotNumber)).toBe(refusal)
  })
})

describe('lastExpiringDayOf', () => {
  it.each<[string, string, string, number, string]>([
    [
      'in the evening in Tokyo',
      '2026-11-14T09:00:00.000Z',
      'Asia/Tokyo',
      30,
      '2026-12-14',
    ],
    [
      'at the last moment of a day in Tokyo',
      '2026-11-14T14:59:59.999Z',
      'Asia/Tokyo',
      0,
      '2026-11-14',
    ],
    [
      'at the first moment of a day in Tokyo',
      '2026-11-14T15:00:00.000Z',
      'Asia/Tokyo',
      0,
      '2026-11-15',
    ],
    [
      'where the day is still the day before',
      '2026-11-14T09:00:00.000Z',
      'Pacific/Pago_Pago',
      0,
      '2026-11-13',
    ],
    [
      'where the day is already the day after',
      '2026-11-14T11:00:00.000Z',
      'Pacific/Kiritimati',
      0,
      '2026-11-15',
    ],
    [
      'across the end of a year',
      '2026-12-20T00:00:00.000Z',
      'Asia/Tokyo',
      30,
      '2027-01-19',
    ],
    [
      'across the 29th of February',
      '2028-02-28T00:00:00.000Z',
      'UTC',
      1,
      '2028-02-29',
    ],
    [
      'a year ahead',
      '2026-11-14T09:00:00.000Z',
      'Asia/Tokyo',
      365,
      '2027-11-14',
    ],
    [
      'on the day the clocks go forward',
      '2026-03-08T06:30:00.000Z',
      'America/New_York',
      1,
      '2026-03-09',
    ],
  ])('counts the days from today %s', (_case, now, timezone, days, last) => {
    expect(lastExpiringDayOf(new Date(now), timezone, days)).toBe(last)
  })

  it.each(['Mars/Olympus_Mons', '', 'Tokyo'])(
    'answers null for a time zone the runtime does not know: %j',
    (timezone) => {
      expect(
        lastExpiringDayOf(new Date('2026-11-14T09:00:00.000Z'), timezone, 30),
      ).toBeNull()
    },
  )
})

describe('who reaches the stock of a salon', () => {
  const salonReach = { type: 'salon', salonId: SALON_ID }

  it.each<[string, Actor, unknown, unknown]>([
    [
      'an administrator',
      actors.admin,
      { type: 'everySalon' },
      { type: 'everySalon' },
    ],
    ['an owner', actors.ofSalon('owner'), salonReach, salonReach],
    ['a manager', actors.ofSalon('manager'), salonReach, salonReach],
    ['a staff member', actors.ofSalon('staff'), salonReach, null],
    ['a customer', actors.customer, null, null],
    [
      'a customer account without a profile',
      actors.customerWithoutProfile,
      null,
      null,
    ],
    ['an account of no scope', actors.withoutScope, null, null],
  ])('reaches %s as such', (_who, actor, reads, keeps) => {
    expect(inventoryReachOf(actor)).toEqual(reads)
    expect(inventoryKeeperReachOf(actor)).toEqual(keeps)
  })

  it('reaches the salon of the member and no other', () => {
    const reach = inventoryReachOf(actors.ofSalon('owner', OTHER_SALON_ID))

    expect(reach).toEqual({ type: 'salon', salonId: OTHER_SALON_ID })
  })
})
