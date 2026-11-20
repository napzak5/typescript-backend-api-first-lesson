import { describe, expect, it } from 'vitest'
import {
  readTreatmentConditions,
  treatmentConditionsIn,
  treatmentQueryOf,
} from './treatment-search'
import type { TreatmentConditions } from './treatments-api'

const STAFF = '7c4a9e2b-1f3d-4b8a-9e6c-5d2f8a1b3c70'
const CUSTOMER = 'b08e3c6f-5d7b-4fce-9cad-9b6d2e5f7ab4'

const formOf = (fields: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    values.set(name, value)
  }
  return values
}

describe('treatmentConditionsIn', () => {
  it('should read every condition of the query', () => {
    expect(
      treatmentConditionsIn(
        new URLSearchParams({
          staff: STAFF.toUpperCase(),
          customer: CUSTOMER,
          from: '2026-11-01',
          to: '2026-11-20',
        }),
      ),
    ).toEqual({
      staff: STAFF,
      customer: CUSTOMER,
      from: '2026-11-01',
      to: '2026-11-20',
    })
  })

  it.each<[string, Record<string, string>, TreatmentConditions]>([
    ['an ID that is none', { staff: 'misaki', customer: '1' }, {}],
    ['a day that is none', { from: '2026-02-30', to: 'today' }, {}],
    [
      'a last day before the first',
      { from: '2026-11-20', to: '2026-11-01' },
      { from: '2026-11-20' },
    ],
    ['a day the API does not take', { from: '1899-12-31' }, {}],
  ])('should take %s as no condition', (_case, query, conditions) => {
    expect(treatmentConditionsIn(new URLSearchParams(query))).toEqual(
      conditions,
    )
  })
})

describe('readTreatmentConditions', () => {
  it('should read what was filled in, and nothing of what was left empty', () => {
    expect(
      readTreatmentConditions(
        formOf({ staff: STAFF, customer: '', from: '2026-11-01', to: '' }),
      ),
    ).toEqual({
      type: 'valid',
      request: { staff: STAFF, from: '2026-11-01' },
    })
  })

  it('should keep the customer the list was opened for', () => {
    expect(readTreatmentConditions(formOf({ customer: CUSTOMER }))).toEqual({
      type: 'valid',
      request: { customer: CUSTOMER },
    })
  })

  it('should refuse a day that is none', () => {
    expect(
      readTreatmentConditions(formOf({ from: '2026-13-01', to: '20261120' })),
    ).toEqual({
      type: 'invalid',
      errors: {
        from: '日付を入力してください。',
        to: '日付を入力してください。',
      },
    })
  })

  it('should refuse a last day before the first', () => {
    expect(
      readTreatmentConditions(formOf({ from: '2026-11-20', to: '2026-11-19' })),
    ).toEqual({
      type: 'invalid',
      errors: {
        to: '終わりの日は、始まりの日と同じか、その後にしてください。',
      },
    })
  })

  it('should take one day as the first and the last', () => {
    expect(
      readTreatmentConditions(formOf({ from: '2026-11-20', to: '2026-11-20' })),
    ).toEqual({
      type: 'valid',
      request: { from: '2026-11-20', to: '2026-11-20' },
    })
  })
})

describe('treatmentQueryOf', () => {
  it('should keep the conditions in the order of the form, and nothing else', () => {
    expect(
      treatmentQueryOf({ to: '2026-11-20', staff: STAFF }).toString(),
    ).toBe(`staff=${STAFF}&to=2026-11-20`)
  })

  it('should read back the conditions it keeps', () => {
    const conditions = {
      staff: STAFF,
      customer: CUSTOMER,
      from: '2026-11-01',
      to: '2026-11-20',
    }

    expect(treatmentConditionsIn(treatmentQueryOf(conditions))).toEqual(
      conditions,
    )
  })
})
