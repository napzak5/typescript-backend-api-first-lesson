import { describe, expect, it } from 'vitest'
import {
  AVOIDED_STAFF_ID,
  dbCustomerPreferences,
  emptyCustomerPreferences,
  PREFERRED_STAFF_ID,
  UNNAMED_STAFF_ID,
} from '../../../__tests__/fixtures/customer-preferences-fixtures'
import { noCustomerPreferences } from '../../../models/customer-preferences'
import { customerPreferencesRuleIssues } from '..'

const avoided = [
  {
    field: 'preferredStaffId',
    rule: 'avoided',
    message: 'Must not be a staff member the customer avoids',
  },
]

describe('customerPreferencesRuleIssues', () => {
  it('finds nothing when the preferred staff member is not among the avoided ones', () => {
    expect(customerPreferencesRuleIssues(dbCustomerPreferences())).toEqual([])
  })

  it.each([
    ['the only one', [PREFERRED_STAFF_ID]],
    ['the first of several', [PREFERRED_STAFF_ID, AVOIDED_STAFF_ID]],
    [
      'the last of several',
      [AVOIDED_STAFF_ID, UNNAMED_STAFF_ID, PREFERRED_STAFF_ID],
    ],
  ])(
    'reports a preferred staff member who is %s of the avoided ones, under preferredStaffId',
    (_case, avoidStaffIds) => {
      expect(
        customerPreferencesRuleIssues({
          preferredStaffId: PREFERRED_STAFF_ID,
          avoidStaffIds,
        }),
      ).toEqual(avoided)
    },
  )

  it.each([
    ['no staff member is avoided', []],
    ['staff members are avoided', [AVOIDED_STAFF_ID, PREFERRED_STAFF_ID]],
  ])(
    'finds nothing without a preferred staff member, when %s',
    (_case, avoidStaffIds) => {
      expect(
        customerPreferencesRuleIssues({
          preferredStaffId: null,
          avoidStaffIds,
        }),
      ).toEqual([])
    },
  )

  it('finds nothing when a staff member is preferred and none is avoided', () => {
    expect(
      customerPreferencesRuleIssues({
        preferredStaffId: PREFERRED_STAFF_ID,
        avoidStaffIds: [],
      }),
    ).toEqual([])
  })

  it('reads the two columns only', () => {
    expect(
      customerPreferencesRuleIssues(
        dbCustomerPreferences({
          preferredTimeSlots: 'not a list',
          stylePreferences: 'not an object',
          communicationStyle: PREFERRED_STAFF_ID,
          specialRequests: AVOIDED_STAFF_ID,
        }),
      ),
    ).toEqual([])
  })
})

describe('noCustomerPreferences', () => {
  it('has no entry in a list and nothing else set', () => {
    expect(noCustomerPreferences()).toEqual(emptyCustomerPreferences())
  })

  it('keeps the rule that ties the columns', () => {
    expect(customerPreferencesRuleIssues(noCustomerPreferences())).toEqual([])
  })

  it('is a new value every time, so that what one caller changes no other sees', () => {
    const first = noCustomerPreferences()
    const second = noCustomerPreferences()

    expect(first).not.toBe(second)
    expect(first.avoidStaffIds).not.toBe(second.avoidStaffIds)
    expect(first.preferredTimeSlots).not.toBe(second.preferredTimeSlots)
  })
})
