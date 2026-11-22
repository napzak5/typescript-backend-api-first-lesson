import { describe, expect, it } from 'vitest'
import {
  type OrderConditions,
  orderConditionsIn,
  orderListParamsOf,
  orderQueryOf,
  readOrderConditions,
} from './order-search'

const SALON_ID = '3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60'

/** The values of a form, under the names of its controls */
const formOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.set(name, value)
  }

  return values
}

describe('orderConditionsIn', () => {
  it('should read the status, the supplier and the days of an address', () => {
    expect(
      orderConditionsIn(
        new URLSearchParams(
          'status=shipped&supplier=%20A%26B%20%E5%95%86%E4%BA%8B%20&from=2026-11-01&to=2026-11-30',
        ),
      ),
    ).toEqual({
      status: 'shipped',
      supplier: 'A&B 商事',
      from: '2026-11-01',
      to: '2026-11-30',
    })
  })

  it('should keep a supplier of 255 characters, counted as the API counts them', () => {
    expect(
      orderConditionsIn(new URLSearchParams({ supplier: '𠮷'.repeat(255) })),
    ).toEqual({ supplier: '𠮷'.repeat(255) })
  })

  it.each<[string, string]>([
    ['a status that is none', 'status=lost'],
    ['a blank supplier', 'supplier=%20%20'],
    ['a supplier longer than the API takes', `supplier=${'仕'.repeat(256)}`],
    ['a day that is none', 'from=2026-02-30'],
    ['a last day before the first', 'from=2026-11-20&to=2026-11-19'],
  ])('should take %s as no condition', (_, query) => {
    const conditions = orderConditionsIn(new URLSearchParams(query))

    expect(Object.keys(conditions).filter((name) => name !== 'from')).toEqual(
      [],
    )
  })

  it('should take a supplier of exactly 255 letters', () => {
    expect(
      orderConditionsIn(new URLSearchParams(`supplier=${'仕'.repeat(255)}`)),
    ).toEqual({ supplier: '仕'.repeat(255) })
  })
})

describe('readOrderConditions', () => {
  it('should read what was filled in, each of it if it was', () => {
    expect(
      readOrderConditions(
        formOf({
          status: 'draft',
          supplier: ' 東京 ',
          from: '',
          to: '2026-11-20',
        }),
      ),
    ).toEqual({
      type: 'valid',
      value: { status: 'draft', supplier: '東京', to: '2026-11-20' },
    })
    expect(
      readOrderConditions(
        formOf({ status: '', supplier: '', from: '', to: '' }),
      ),
    ).toEqual({ type: 'valid', value: {} })
  })

  it('should say what is wrong with a supplier too long and a day that is none', () => {
    expect(
      readOrderConditions(
        formOf({ supplier: '仕'.repeat(256), from: '2026-13-01', to: '' }),
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        supplier: '仕入先は、255 文字以内で入力してください。',
        from: '日付を入力してください。',
      },
    })
  })

  it('should say that the last day is before the first, and take the same day', () => {
    expect(
      readOrderConditions(formOf({ from: '2026-11-20', to: '2026-11-19' })),
    ).toEqual({
      type: 'invalid',
      errors: {
        to: '終わりの日は、始まりの日と同じか、その後にしてください。',
      },
    })
    expect(
      readOrderConditions(formOf({ from: '2026-11-20', to: '2026-11-20' })),
    ).toEqual({
      type: 'valid',
      value: { from: '2026-11-20', to: '2026-11-20' },
    })
  })
})

describe('orderQueryOf', () => {
  it('should keep the conditions in the address in one order, and nothing for no condition', () => {
    const conditions: OrderConditions = {
      to: '2026-11-30',
      supplier: 'A&B 商事',
      status: 'approved',
    }

    expect(orderQueryOf(conditions).toString()).toBe(
      'status=approved&supplier=A%26B+%E5%95%86%E4%BA%8B&to=2026-11-30',
    )
    expect(orderQueryOf({}).toString()).toBe('')
  })
})

describe('orderListParamsOf', () => {
  it('should ask for the days at the salon from the moment the first begins to the moment before the day after the last', () => {
    expect(
      orderListParamsOf(
        SALON_ID,
        {
          status: 'ordered',
          supplier: '東京',
          from: '2026-11-01',
          to: '2026-11-30',
        },
        'Asia/Tokyo',
      ),
    ).toEqual({
      salonId: SALON_ID,
      status: 'ordered',
      supplier: '東京',
      startDate: '2026-10-31T15:00:00.000Z',
      endDate: '2026-11-30T14:59:59.999Z',
    })
  })

  it('should ask for every order of the salon without conditions', () => {
    expect(orderListParamsOf(SALON_ID, {}, 'Asia/Tokyo')).toEqual({
      salonId: SALON_ID,
    })
  })
})
