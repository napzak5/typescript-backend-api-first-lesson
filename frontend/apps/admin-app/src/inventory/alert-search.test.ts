import { describe, expect, it } from 'vitest'
import {
  type AlertConditions,
  alertConditionsIn,
  alertQueryOf,
  isNarrowedAlerts,
  readAlertConditions,
} from './alert-search'

const formOf = (entries: [string, string][]): FormData => {
  const values = new FormData()
  for (const [name, value] of entries) {
    values.append(name, value)
  }

  return values
}

describe('alertConditionsIn', () => {
  it.each<[string, AlertConditions]>([
    ['', {}],
    [
      'alert=expired&severity=critical&acknowledged=false',
      { alert: 'expired', severity: 'critical', acknowledged: false },
    ],
    ['acknowledged=true', { acknowledged: true }],
    ['alert=missing&severity=urgent&acknowledged=yes', {}],
    ['acknowledged=toString', {}],
    ['type=low_stock', {}],
  ])('should read 「%s」', (query, conditions) => {
    expect(alertConditionsIn(new URLSearchParams(query))).toEqual(conditions)
  })

  it.each<AlertConditions>([
    {},
    { alert: 'overstock' },
    { severity: 'info', acknowledged: true },
    { alert: 'low_stock', severity: 'warning', acknowledged: false },
  ])('should read back the query it keeps %o in', (conditions) => {
    expect(alertConditionsIn(alertQueryOf(conditions))).toEqual(conditions)
  })
})

describe('readAlertConditions', () => {
  it('should read the conditions chosen, and none of those left as all', () => {
    expect(
      readAlertConditions(
        formOf([
          ['alert', ''],
          ['severity', 'warning'],
          ['acknowledged', 'false'],
        ]),
      ),
    ).toEqual({ severity: 'warning', acknowledged: false })
    expect(
      readAlertConditions(
        formOf([
          ['alert', 'expiring'],
          ['severity', ''],
          ['acknowledged', ''],
        ]),
      ),
    ).toEqual({ alert: 'expiring' })
  })
})

describe('alertQueryOf', () => {
  it('should keep the conditions under the names of the parameters of the API, in one order', () => {
    expect(
      alertQueryOf({
        acknowledged: false,
        severity: 'critical',
        alert: 'expired',
      }).toString(),
    ).toBe('alert=expired&severity=critical&acknowledged=false')
    expect(alertQueryOf({}).toString()).toBe('')
  })
})

describe('isNarrowedAlerts', () => {
  it.each<[AlertConditions, boolean]>([
    [{}, false],
    [{ alert: 'expired' }, true],
    [{ acknowledged: false }, true],
  ])(
    'should say of %o whether it narrows the alerts',
    (conditions, narrowed) => {
      expect(isNarrowedAlerts(conditions)).toBe(narrowed)
    },
  )
})
