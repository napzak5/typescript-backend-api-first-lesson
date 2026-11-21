import { describe, expect, it } from 'vitest'
import { pendingOrder } from './components/examples'
import {
  afterOrderChange,
  deliveryDayOf,
  readOrderChange,
} from './order-change'

/** The values of a form, under the names of its controls */
const formOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.set(name, value)
  }

  return values
}

const TOKYO = 'Asia/Tokyo'

/** The form as it opens on the order of the stories: due on the 27th in Tokyo, with notes of two lines */
const AS_OPENED = {
  expectedDelivery: '2026-11-27',
  deliveryNotes: '',
  notes: '年末の繁忙期の分。\n届いたら、バックヤードの棚 B-2 へ。',
}

describe('deliveryDayOf', () => {
  it('should show the day of the delivery at the salon, and nothing when none is set', () => {
    expect(deliveryDayOf('2026-11-26T15:00:00.000Z', TOKYO)).toBe('2026-11-27')
    expect(deliveryDayOf('2026-11-26T15:00:00.000Z', 'UTC')).toBe('2026-11-26')
    expect(deliveryDayOf(null, TOKYO)).toBe('')
  })
})

describe('readOrderChange', () => {
  it('should send nothing for a form left as it was opened', () => {
    expect(readOrderChange(formOf(AS_OPENED), pendingOrder, TOKYO)).toEqual({
      type: 'unchanged',
    })
  })

  it('should send nothing for blanks added around what the order holds', () => {
    expect(
      readOrderChange(
        formOf({
          ...AS_OPENED,
          notes: ` ${AS_OPENED.notes}\n`,
          deliveryNotes: ' ',
        }),
        pendingOrder,
        TOKYO,
      ),
    ).toEqual({ type: 'unchanged' })
  })

  it('should send the day that was changed, as the moment it begins at the salon', () => {
    expect(
      readOrderChange(
        formOf({ ...AS_OPENED, expectedDelivery: '2026-12-01' }),
        pendingOrder,
        TOKYO,
      ),
    ).toEqual({
      type: 'valid',
      request: { expectedDelivery: '2026-11-30T15:00:00.000Z' },
    })
  })

  it('should clear what was made empty, and send the notes that were written', () => {
    expect(
      readOrderChange(
        formOf({
          expectedDelivery: '',
          deliveryNotes: ' 午前中に、裏口へ。 ',
          notes: '  ',
        }),
        pendingOrder,
        TOKYO,
      ),
    ).toEqual({
      type: 'valid',
      request: {
        expectedDelivery: null,
        deliveryNotes: '午前中に、裏口へ。',
        notes: null,
      },
    })
  })

  it('should send the notes written on an order that had none', () => {
    expect(
      readOrderChange(
        formOf({ expectedDelivery: '', deliveryNotes: '', notes: '至急' }),
        { expectedDelivery: null, deliveryNotes: null, notes: null },
        TOKYO,
      ),
    ).toEqual({ type: 'valid', request: { notes: '至急' } })
  })

  it('should ask for a day the API takes', () => {
    expect(
      readOrderChange(
        formOf({ ...AS_OPENED, expectedDelivery: '2026-02-30' }),
        pendingOrder,
        TOKYO,
      ),
    ).toEqual({
      type: 'invalid',
      errors: { expectedDelivery: '日付を入力してください。' },
    })
  })
})

describe('afterOrderChange', () => {
  it('should say what is wrong with the day at its control', () => {
    expect(
      afterOrderChange({
        type: 'invalid',
        values: [{ field: 'expectedDelivery', rule: 'invalid_format' }],
      }),
    ).toEqual({
      message: undefined,
      errors: { expectedDelivery: '日付を入力してください。' },
    })
  })

  it('should ask to check the values when the API refused one the form has no control of', () => {
    expect(
      afterOrderChange({
        type: 'invalid',
        values: [
          { field: 'expectedDelivery', rule: 'invalid_format' },
          { field: 'notes', rule: 'custom' },
        ],
      }),
    ).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: { expectedDelivery: '日付を入力してください。' },
    })
    expect(afterOrderChange({ type: 'invalid', values: [] })).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<[Parameters<typeof afterOrderChange>[0], string]>([
    [{ type: 'forbidden' }, 'このアカウントでは、この発注を直せません。'],
    [
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      '発注を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say what came of %o', (outcome, message) => {
    expect(afterOrderChange(outcome)).toEqual({ message, errors: {} })
  })
})
