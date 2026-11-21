import { describe, expect, it } from 'vitest'
import { salon } from '../bookings/components/examples'
import {
  isNarrowedHistory,
  type MovementConditions,
  movementConditionsIn,
  movementParamsOf,
  movementQueryOf,
  readMovementConditions,
} from './movement-search'

const formOf = (entries: [string, string][]): FormData => {
  const values = new FormData()
  for (const [name, value] of entries) {
    values.append(name, value)
  }

  return values
}

describe('movementConditionsIn', () => {
  it.each<[string, MovementConditions]>([
    ['', {}],
    [
      'type=use&from=2026-11-01&to=2026-11-30',
      { type: 'use', from: '2026-11-01', to: '2026-11-30' },
    ],
    ['type=moving', {}],
    ['from=2026-11-31', {}],
    ['from=2026-11-20&to=2026-11-19', { from: '2026-11-20' }],
    ['to=2026-11-19', { to: '2026-11-19' }],
    ['days=7', {}],
  ])('should read 「%s」', (query, conditions) => {
    expect(movementConditionsIn(new URLSearchParams(query))).toEqual(conditions)
  })

  it.each<MovementConditions>([
    {},
    { type: 'disposal' },
    { from: '2026-11-01', to: '2026-11-01' },
    { type: 'purchase', to: '2026-12-31' },
  ])('should read back the query it keeps %o in', (conditions) => {
    expect(movementConditionsIn(movementQueryOf(conditions))).toEqual(
      conditions,
    )
  })
})

describe('readMovementConditions', () => {
  it('should read the conditions filled in, and none of those left empty', () => {
    expect(
      readMovementConditions(
        formOf([
          ['type', 'sale'],
          ['from', ''],
          ['to', '2026-11-30'],
        ]),
      ),
    ).toEqual({ type: 'valid', request: { type: 'sale', to: '2026-11-30' } })
    expect(
      readMovementConditions(
        formOf([
          ['type', ''],
          ['from', ''],
          ['to', ''],
        ]),
      ),
    ).toEqual({ type: 'valid', request: {} })
  })

  it('should say a day that is none, and a last day before the first', () => {
    expect(
      readMovementConditions(
        formOf([
          ['type', ''],
          ['from', '2026-02-30'],
          ['to', ''],
        ]),
      ),
    ).toEqual({ type: 'invalid', errors: { from: '日付を入力してください。' } })
    expect(
      readMovementConditions(
        formOf([
          ['type', ''],
          ['from', '2026-11-20'],
          ['to', '2026-11-19'],
        ]),
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        to: '終わりの日は、始まりの日と同じか、その後にしてください。',
      },
    })
  })
})

describe('isNarrowedHistory', () => {
  it.each<[MovementConditions, boolean]>([
    [{}, false],
    [{ type: 'use' }, true],
    [{ to: '2026-11-30' }, true],
  ])(
    'should tell whether %o narrows the history: %s',
    (conditions, narrowed) => {
      expect(isNarrowedHistory(conditions)).toBe(narrowed)
    },
  )
})

describe('movementParamsOf', () => {
  it('should ask for the days at the salon, from the moment the first begins to the moment before the day after the last', () => {
    expect(
      movementParamsOf(
        { type: 'use', from: '2026-11-01', to: '2026-11-30' },
        salon.timezone,
      ),
    ).toEqual({
      transactionType: 'use',
      startDate: '2026-10-31T15:00:00.000Z',
      endDate: '2026-11-30T14:59:59.999Z',
    })
  })

  it('should ask for nothing that is no condition', () => {
    expect(movementParamsOf({}, salon.timezone)).toEqual({})
  })
})
