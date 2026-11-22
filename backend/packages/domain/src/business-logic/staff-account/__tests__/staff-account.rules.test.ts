import { describe, expect, it } from 'vitest'
import { actors, dataOf } from '../../../__tests__/fixtures/auth-fixtures'
import { OTHER_SALON_ID, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import { STAFF_MEMBER_ID } from '../../../__tests__/fixtures/staff-fixtures'
import type { Actor } from '../../../models/auth'
import { parseSalonIdOfPath } from '../../../models/salon'
import { parseStaffId } from '../../../models/staff'
import { mayKeepStaffAccounts } from '../_shared/authorization'
import {
  accountNotFound,
  ownAccountStaysLinked,
  ownRoleStays,
} from '../_shared/refusals'

const salonId = dataOf(parseSalonIdOfPath(SALON_ID))

describe('mayKeepStaffAccounts', () => {
  it.each<[string, Actor]>([
    ['an administrator', actors.admin],
    ['the owner of the salon', actors.ofSalon('owner')],
  ])('lets %s keep the accounts of the staff of the salon', (_who, actor) => {
    expect(mayKeepStaffAccounts(actor, salonId)).toBe(true)
  })

  it.each<[string, Actor]>([
    ['a manager of the salon', actors.ofSalon('manager')],
    ['a staff member of the salon', actors.ofSalon('staff')],
    ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
    ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
    ['a customer', actors.customer],
    ['a customer without a profile', actors.customerWithoutProfile],
    ['a user without a scope', actors.withoutScope],
  ])('does not let %s', (_who, actor) => {
    expect(mayKeepStaffAccounts(actor, salonId)).toBe(false)
  })
})

describe('the refusals of the accounts of staff members', () => {
  it('names the staff member whose account was not found', () => {
    expect(accountNotFound(dataOf(parseStaffId(STAFF_MEMBER_ID)))).toEqual({
      type: 'notFound',
      entity: 'Account of staff member',
      id: STAFF_MEMBER_ID,
    })
  })

  it('tells an actor apart which of the two things they may not do to their own account', () => {
    expect(ownRoleStays()).toEqual({
      type: 'conflict',
      message: 'You cannot change the role of your own account',
    })
    expect(ownAccountStaysLinked()).toEqual({
      type: 'conflict',
      message: 'You cannot unlink your own account',
    })
  })
})
