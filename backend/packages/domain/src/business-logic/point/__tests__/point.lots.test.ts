import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import { dbPointTransaction } from '../../../__tests__/fixtures/point-fixtures'
import type { DbPointTransaction } from '../../../models/point'
import { expiringOf, lotsOf, planExpiry } from '../_shared/lots'
import { expiringUntilOf, issuesOfProcessBefore } from '../_shared/plan'

/**
 * The point transactions of one customer in the order they were written,
 * each with the balance after it: `[type, points, expiryDate]` each.
 */
const ledger = (
  ...rows: [DbPointTransaction['transactionType'], number, string | null][]
): DbPointTransaction[] => {
  let balance = 0
  return rows.map(([transactionType, points, expiryDate], index) => {
    balance += points
    return dbPointTransaction({
      id: `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5${String(index).padStart(3, '0')}`,
      transactionType,
      points,
      balance,
      description: null,
      referenceType: null,
      referenceId: null,
      expiryDate,
      createdAt: `2026-11-${String(index + 1).padStart(2, '0')} 10:00:00+00`,
    })
  })
}

/** What is left of each lot, by the index of the row that made it. */
const leftOf = (transactions: DbPointTransaction[]): [number, number][] =>
  lotsOf(transactions).map(({ transaction, left }) => [
    transactions.indexOf(transaction),
    left,
  ])

describe('lotsOf', () => {
  it('has no lots without transactions', () => {
    expect(lotsOf([])).toEqual([])
  })

  it('makes a lot of each increase, with its expiry date, in the order written', () => {
    const transactions = ledger(
      ['adjusted', 300, null],
      ['earned', 120, '2027-01-31'],
      ['earned', 80, null],
      ['transferred', 50, null],
    )

    expect(lotsOf(transactions)).toEqual([
      { transaction: transactions[0], expiryDate: null, left: 300 },
      { transaction: transactions[1], expiryDate: '2027-01-31', left: 120 },
      { transaction: transactions[2], expiryDate: null, left: 80 },
      { transaction: transactions[3], expiryDate: null, left: 50 },
    ])
  })

  it('takes a use from the earliest expiry date first, whatever the order written', () => {
    const transactions = ledger(
      ['earned', 100, '2027-03-31'],
      ['earned', 100, '2027-01-31'],
      ['used', -60, null],
    )

    expect(leftOf(transactions)).toEqual([
      [0, 100],
      [1, 40],
    ])
  })

  it('takes the lots without an expiry date last', () => {
    const transactions = ledger(
      ['adjusted', 500, null],
      ['earned', 100, '2027-12-31'],
      ['used', -150, null],
    )

    expect(leftOf(transactions)).toEqual([[0, 450]])
  })

  it('takes lots of one expiry date in the order they were written', () => {
    const transactions = ledger(
      ['earned', 100, '2027-01-31'],
      ['earned', 100, '2027-01-31'],
      ['used', -130, null],
    )

    expect(leftOf(transactions)).toEqual([[1, 70]])
  })

  it('takes lots without an expiry date in the order they were written', () => {
    const transactions = ledger(
      ['adjusted', 100, null],
      ['earned', 100, null],
      ['used', -130, null],
    )

    expect(leftOf(transactions)).toEqual([[1, 70]])
  })

  it('never takes a later earning for an earlier use', () => {
    const transactions = ledger(
      ['adjusted', 100, null],
      ['used', -100, null],
      ['earned', 100, '2027-01-31'],
    )

    expect(leftOf(transactions)).toEqual([[2, 100]])
  })

  it('takes an expiry and an adjustment downwards as it takes a use', () => {
    const transactions = ledger(
      ['earned', 100, '2026-10-31'],
      ['earned', 100, '2027-01-31'],
      ['adjusted', 300, null],
      ['expired', -100, null],
      ['adjusted', -150, null],
    )

    expect(leftOf(transactions)).toEqual([[2, 250]])
  })

  it('leaves what is left of a lot for the next decrease', () => {
    const transactions = ledger(
      ['earned', 100, '2027-01-31'],
      ['earned', 100, '2027-02-28'],
      ['used', -30, null],
      ['used', -30, null],
      ['used', -60, null],
    )

    expect(leftOf(transactions)).toEqual([[1, 80]])
  })

  it('leaves as many points as the latest balance', () => {
    const transactions = ledger(
      ['adjusted', 2500, null],
      ['earned', 120, '2027-01-31'],
      ['used', -1000, null],
      ['earned', 300, '2026-12-31'],
      ['adjusted', -50, null],
      ['earned', 40, null],
      ['used', -700, null],
    )

    const left = lotsOf(transactions).reduce((sum, lot) => sum + lot.left, 0)
    expect(left).toBe(transactions.at(-1)?.balance)
    expect(left).toBe(1210)
  })
})

describe('expiringOf', () => {
  it('counts what is left of the earnings whose expiry date is the day or earlier', () => {
    const transactions = ledger(
      ['earned', 100, '2026-12-20'],
      ['earned', 200, '2026-12-21'],
      ['earned', 300, '2026-11-01'],
      ['adjusted', 400, null],
      ['earned', 500, null],
      ['used', -30, null],
    )

    expect(expiringOf(transactions, '2026-12-20')).toEqual({
      expiringPoints: 370,
      expirationDate: '2026-11-01',
      transactions: [transactions[2], transactions[0]],
    })
  })

  it('lists the earnings by expiry date, then in the order they were written', () => {
    const transactions = ledger(
      ['earned', 100, '2026-12-10'],
      ['earned', 100, '2026-12-01'],
      ['earned', 100, '2026-12-10'],
      ['earned', 100, '2026-12-05'],
    )

    expect(
      expiringOf(transactions, '2026-12-31').transactions.map((transaction) =>
        transactions.indexOf(transaction),
      ),
    ).toEqual([1, 3, 0, 2])
  })

  it('leaves out an earning that was used up or expired', () => {
    const transactions = ledger(
      ['earned', 100, '2026-11-01'],
      ['expired', -100, null],
      ['earned', 100, '2026-12-01'],
      ['used', -100, null],
      ['earned', 50, '2026-12-02'],
    )

    expect(expiringOf(transactions, '2026-12-31')).toEqual({
      expiringPoints: 50,
      expirationDate: '2026-12-02',
      transactions: [transactions[4]],
    })
  })

  it('finds nothing when no earning is near its expiry date', () => {
    const transactions = ledger(
      ['adjusted', 400, null],
      ['earned', 100, '2027-01-01'],
    )

    expect(expiringOf(transactions, '2026-12-31')).toEqual({
      expiringPoints: 0,
      expirationDate: null,
      transactions: [],
    })
  })
})

describe('planExpiry', () => {
  it('expires what is left of the earnings whose expiry date is before the day', () => {
    const transactions = ledger(
      ['earned', 100, '2026-11-17'],
      ['earned', 200, '2026-11-18'],
      ['earned', 300, '2026-11-19'],
      ['adjusted', 400, null],
      ['used', -30, null],
    )

    expect(planExpiry(CUSTOMER_ID, 970, transactions, '2026-11-19')).toEqual({
      type: 'planned',
      write: {
        customerId: CUSTOMER_ID,
        transactionType: 'expired',
        points: -270,
        balance: 700,
        description: null,
        referenceType: null,
        referenceId: null,
        expiryDate: null,
      },
    })
  })

  it('writes the balance after it from the balance it is given', () => {
    const transactions = ledger(['earned', 100, '2026-11-01'])

    expect(
      planExpiry(CUSTOMER_ID, 150, transactions, '2026-11-19'),
    ).toMatchObject({ type: 'planned', write: { points: -100, balance: 50 } })
  })

  it('finds nothing a second time: the points it expired are counted as taken', () => {
    const transactions = ledger(
      ['earned', 100, '2026-11-01'],
      ['adjusted', 50, null],
      ['expired', -100, null],
    )

    expect(planExpiry(CUSTOMER_ID, 50, transactions, '2026-11-19')).toEqual({
      type: 'nothingLapsed',
    })
  })

  it.each([
    [
      'no earning has an expiry date',
      ledger(['adjusted', 100, null], ['earned', 100, null]),
    ],
    [
      'the expiry date is the day itself',
      ledger(['earned', 100, '2026-11-19']),
    ],
    [
      'the lapsed earning was used up',
      ledger(['earned', 100, '2026-11-01'], ['used', -100, null]),
    ],
    ['there is no transaction', ledger()],
  ])('finds nothing when %s', (_, transactions) => {
    expect(planExpiry(CUSTOMER_ID, 0, transactions, '2026-11-19')).toEqual({
      type: 'nothingLapsed',
    })
  })
})

describe('issuesOfProcessBefore', () => {
  const now = new Date('2026-11-20T03:00:00.000Z')

  it.each([
    ['null', null],
    ['yesterday in UTC', '2026-11-19'],
    ['an earlier day', '2026-01-01'],
  ])('takes %s', (_, processBefore) => {
    expect(issuesOfProcessBefore(processBefore, now)).toEqual([])
  })

  it('refuses today in UTC: points whose expiry date is yesterday may still be used', () => {
    expect(issuesOfProcessBefore('2026-11-20', now)).toEqual([
      {
        field: 'processBefore',
        rule: 'too_big',
        message: 'Must not be later than 2026-11-19',
      },
    ])
  })

  it('counts the days in UTC, not in the time zone of the server', () => {
    const lateInUtc = new Date('2026-11-20T23:59:59.999Z')

    expect(issuesOfProcessBefore('2026-11-19', lateInUtc)).toEqual([])
    expect(issuesOfProcessBefore('2026-11-20', lateInUtc)).toHaveLength(1)
  })
})

describe('expiringUntilOf', () => {
  it.each([
    [new Date('2026-11-20T03:00:00.000Z'), 30, '2026-12-20'],
    [new Date('2026-11-20T03:00:00.000Z'), 1, '2026-11-21'],
    [new Date('2026-11-20T23:59:59.999Z'), 1, '2026-11-21'],
    [new Date('2026-11-20T00:00:00.000Z'), 365, '2027-11-20'],
    [new Date('2027-12-31T12:00:00.000Z'), 60, '2028-02-29'],
  ])('counts %s and %s days to %s', (now, days, until) => {
    expect(expiringUntilOf(now, days)).toBe(until)
  })
})
