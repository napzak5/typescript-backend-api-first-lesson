import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import {
  type LedgerConditions,
  ledgerConditionsIn,
  ledgerQueryOf,
  rangeNameOf,
  readLedgerConditions,
} from './sales-ledger'

const TODAY = '2026-11-20'

describe('ledgerConditionsIn', () => {
  it.each<[string, string, LedgerConditions]>([
    ['nothing', '', { from: TODAY, to: TODAY }],
    [
      'a range and a state',
      'from=2026-11-01&to=2026-11-30&paymentStatus=processing',
      { from: '2026-11-01', to: '2026-11-30', paymentStatus: 'processing' },
    ],
    [
      'a start only',
      'from=2026-11-01',
      { from: '2026-11-01', to: '2026-11-01' },
    ],
    [
      'an end before the start',
      'from=2026-11-10&to=2026-11-01',
      { from: '2026-11-10', to: '2026-11-10' },
    ],
    [
      'days and a state that are none',
      'from=yesterday&to=2026-13-01&paymentStatus=paid',
      { from: TODAY, to: TODAY },
    ],
    [
      'a state the API does not write',
      'paymentStatus=failed',
      { from: TODAY, to: TODAY },
    ],
  ])('should read %s', (_case, query, conditions) => {
    // Act, Assert
    expect(ledgerConditionsIn(new URLSearchParams(query), TODAY)).toEqual(
      conditions,
    )
  })
})

describe('readLedgerConditions', () => {
  it('should read the range and the state that were filled in', () => {
    // Act, Assert
    expect(
      readLedgerConditions(
        formOf({ from: '2026-11-01', to: '2026-11-01', paymentStatus: '' }),
      ),
    ).toEqual({
      type: 'valid',
      value: { from: '2026-11-01', to: '2026-11-01' },
    })
  })

  it.each<[string, Record<string, string>, Record<string, string>]>([
    [
      'no days',
      {},
      { from: '日付を入力してください。', to: '日付を入力してください。' },
    ],
    [
      'an end before the start',
      { from: '2026-11-10', to: '2026-11-09' },
      {
        to: '終わりの日は、始まりの日と同じか、その後にしてください。',
      },
    ],
  ])('should refuse %s', (_case, entries, errors) => {
    // Act, Assert
    expect(readLedgerConditions(formOf(entries))).toEqual({
      type: 'invalid',
      errors,
    })
  })
})

describe('ledgerQueryOf', () => {
  it('should keep the conditions in the same order, whatever order they come in', () => {
    // Act, Assert
    expect(
      ledgerQueryOf({
        paymentStatus: 'pending',
        to: '2026-11-30',
        from: '2026-11-01',
      }).toString(),
    ).toBe('from=2026-11-01&to=2026-11-30&paymentStatus=pending')
  })
})

describe('rangeNameOf', () => {
  it.each<[string, LedgerConditions, string]>([
    ['one day', { from: TODAY, to: TODAY }, '2026年11月20日（金）'],
    [
      'a range',
      { from: '2026-11-01', to: TODAY },
      '2026年11月1日（日）〜2026年11月20日（金）',
    ],
  ])('should name %s', (_case, conditions, name) => {
    // Act, Assert
    expect(rangeNameOf(conditions)).toBe(name)
  })
})
