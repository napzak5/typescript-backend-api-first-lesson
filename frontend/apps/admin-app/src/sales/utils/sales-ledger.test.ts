import { formOf } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  type LedgerConditions,
  ledgerConditionsIn,
  ledgerQueryOf,
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

  it.each<[string, Record<string, string>, Record<string, LocalizedText>]>([
    [
      'no days',
      {},
      {
        from: { en: 'Enter a date.', ja: '日付を入力してください。' },
        to: { en: 'Enter a date.', ja: '日付を入力してください。' },
      },
    ],
    [
      'an end before the start',
      { from: '2026-11-10', to: '2026-11-09' },
      {
        to: {
          en: 'Make the last day the same as the first day, or later.',
          ja: '終わりの日は、始まりの日と同じか、その後にしてください。',
        },
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
