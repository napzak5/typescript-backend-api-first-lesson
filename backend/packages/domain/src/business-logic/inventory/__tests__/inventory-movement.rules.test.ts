import type { InventoryTransactionType } from '@beauty-salon-backend/generated'
import { describe, expect, it } from 'vitest'
import { actors, STAFF_ID } from '../../../__tests__/fixtures/auth-fixtures'
import { SALON_ID } from '../../../__tests__/fixtures/fixtures'
import type { Actor } from '../../../models/auth'
import { movementReachOf, performerOf } from '../_shared/authorization'
import {
  directionOf,
  isKeepersMovement,
  largestUnitCostOf,
  needsReason,
  totalCostOf,
} from '../_shared/movements'

/** Each kind of movement: its direction, a reason, and whose it is. */
const KINDS: [InventoryTransactionType, string, boolean, boolean][] = [
  ['purchase', 'in', false, false],
  ['sale', 'out', false, false],
  ['use', 'out', false, false],
  ['return', 'either', false, false],
  ['adjustment', 'either', true, true],
  ['disposal', 'out', true, true],
  ['transfer', 'either', false, true],
]

describe('the rules of a kind of movement', () => {
  it.each(KINDS)(
    'moves a %s %s, states why: %s, and is only the keepers’: %s',
    (type, direction, reason, keepers) => {
      expect(directionOf(type)).toBe(direction)
      expect(needsReason(type)).toBe(reason)
      expect(isKeepersMovement(type)).toBe(keepers)
    },
  )
})

describe('totalCostOf', () => {
  it.each<[number, number, bigint]>([
    [1200, 3, 3600n],
    [1200, -3, 3600n],
    [0, 5, 0n],
    [3, 0.5, 2n],
    [3, -0.5, 2n],
    [1, 0.49, 0n],
    [1, 0.5, 1n],
    [333, 0.01, 3n],
    [3, 0.29, 1n],
    [2_147_483_647, 99_999_999.99, 214_748_364_678_525_164n],
  ])('costs %d yen times %d as %d', (unitCost, quantity, total) => {
    expect(totalCostOf(unitCost, quantity)).toBe(total)
  })
})

describe('largestUnitCostOf', () => {
  it.each<[number, number]>([
    [1, 2_147_483_647],
    [-1, 2_147_483_647],
    [2, 1_073_741_823],
    [0.5, 4_294_967_294],
    [3.07, 699_506_074],
    [99_999_999.99, 21],
  ])(
    'tells the largest unit cost of %d, whose total is within the limit and that of one yen more is not',
    (quantity, largest) => {
      const limit = 2_147_483_647n

      expect(largestUnitCostOf(quantity, 2_147_483_647)).toBe(BigInt(largest))
      expect(totalCostOf(largest, quantity)).toBeLessThanOrEqual(limit)
      expect(totalCostOf(largest + 1, quantity)).toBeGreaterThan(limit)
    },
  )
})

describe('movementReachOf', () => {
  const salon = { type: 'salon', salonId: SALON_ID }

  it.each<[string, Actor, InventoryTransactionType, object | null]>([
    ['an administrator', actors.admin, 'adjustment', { type: 'everySalon' }],
    ['an administrator', actors.admin, 'purchase', { type: 'everySalon' }],
    ['an owner', actors.ofSalon('owner'), 'transfer', salon],
    ['a manager', actors.ofSalon('manager'), 'disposal', salon],
    ['a manager', actors.ofSalon('manager'), 'sale', salon],
    ['a staff member', actors.ofSalon('staff'), 'purchase', salon],
    ['a staff member', actors.ofSalon('staff'), 'sale', salon],
    ['a staff member', actors.ofSalon('staff'), 'use', salon],
    ['a staff member', actors.ofSalon('staff'), 'return', salon],
    ['a staff member', actors.ofSalon('staff'), 'adjustment', null],
    ['a staff member', actors.ofSalon('staff'), 'disposal', null],
    ['a staff member', actors.ofSalon('staff'), 'transfer', null],
    ['a customer', actors.customer, 'purchase', null],
    ['an account of no scope', actors.withoutScope, 'adjustment', null],
  ])('gives %s recording a %s the reach %j', (_case, actor, type, reach) => {
    expect(movementReachOf(actor, type)).toEqual(reach)
  })
})

describe('performerOf', () => {
  it.each<[string, Actor, string | null]>([
    ['the staff member of an owner', actors.ofSalon('owner'), STAFF_ID],
    ['the staff member of a staff member', actors.ofSalon('staff'), STAFF_ID],
    ['no one for an administrator', actors.admin, null],
    ['no one for a customer', actors.customer, null],
    ['no one for an account of no scope', actors.withoutScope, null],
  ])('tells %s', (_case, actor, performer) => {
    expect(performerOf(actor)).toBe(performer)
  })
})
