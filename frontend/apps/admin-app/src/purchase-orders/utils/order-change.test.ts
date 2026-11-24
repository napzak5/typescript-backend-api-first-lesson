import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import { pendingOrder } from '../components/examples'
import {
  afterOrderChange,
  deliveryDayOf,
  readOrderChange,
} from './order-change'

const TOKYO = 'Asia/Tokyo'

/** The form as it opens on the order of the stories: due on the 27th in Tokyo, with notes of two lines */
const AS_OPENED = {
  expectedDelivery: '2026-11-27',
  deliveryNotes: '',
  notes: '年末の繁忙期の分。\n届いたら、バックヤードの棚 B-2 へ。',
}

describe('deliveryDayOf', () => {
  it('should show the day of the delivery at the salon, and nothing when none is set', () => {
    // Assert
    expect(deliveryDayOf('2026-11-26T15:00:00.000Z', TOKYO)).toBe('2026-11-27')
    expect(deliveryDayOf('2026-11-26T15:00:00.000Z', 'UTC')).toBe('2026-11-26')
    expect(deliveryDayOf(null, TOKYO)).toBe('')
  })
})

describe('readOrderChange', () => {
  it('should send nothing for a form left as it was opened', () => {
    // Assert
    expect(readOrderChange(formOf(AS_OPENED), pendingOrder, TOKYO)).toEqual({
      type: 'unchanged',
    })
  })

  it('should send nothing for blanks added around what the order holds', () => {
    // Assert
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
    // Assert
    expect(
      readOrderChange(
        formOf({ ...AS_OPENED, expectedDelivery: '2026-12-01' }),
        pendingOrder,
        TOKYO,
      ),
    ).toEqual({
      type: 'valid',
      value: { expectedDelivery: '2026-11-30T15:00:00.000Z' },
    })
  })

  it('should clear what was made empty, and send the notes that were written', () => {
    // Assert
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
      value: {
        expectedDelivery: null,
        deliveryNotes: '午前中に、裏口へ。',
        notes: null,
      },
    })
  })

  it('should send the notes written on an order that had none', () => {
    // Assert
    expect(
      readOrderChange(
        formOf({ expectedDelivery: '', deliveryNotes: '', notes: '至急' }),
        { expectedDelivery: null, deliveryNotes: null, notes: null },
        TOKYO,
      ),
    ).toEqual({ type: 'valid', value: { notes: '至急' } })
  })

  it('should ask for a day the API takes', () => {
    // Assert
    expect(
      readOrderChange(
        formOf({ ...AS_OPENED, expectedDelivery: '2026-02-30' }),
        pendingOrder,
        TOKYO,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        expectedDelivery: {
          en: 'Enter a date.',
          ja: '日付を入力してください。',
        },
      },
    })
  })
})

describe('afterOrderChange', () => {
  it('should say what is wrong with the day at its control', () => {
    // Assert
    expect(
      afterOrderChange({
        type: 'invalid',
        values: [{ field: 'expectedDelivery', rule: 'invalid_format' }],
      }),
    ).toEqual({
      message: undefined,
      errors: {
        expectedDelivery: {
          en: 'Enter a date.',
          ja: '日付を入力してください。',
        },
      },
    })
  })

  it('should ask to check the values when the API refused one the form has no control of', () => {
    // Assert
    expect(
      afterOrderChange({
        type: 'invalid',
        values: [
          { field: 'expectedDelivery', rule: 'invalid_format' },
          { field: 'notes', rule: 'custom' },
        ],
      }),
    ).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {
        expectedDelivery: {
          en: 'Enter a date.',
          ja: '日付を入力してください。',
        },
      },
    })
    expect(afterOrderChange({ type: 'invalid', values: [] })).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {},
    })
  })

  it.each<[Parameters<typeof afterOrderChange>[0], { en: string; ja: string }]>(
    [
      [
        { type: 'forbidden' },
        {
          en: 'This account cannot edit this order.',
          ja: 'このアカウントでは、この発注を直せません。',
        },
      ],
      [
        { type: 'tooManyRequests' },
        {
          en: 'There are too many requests. Wait a while and try again.',
          ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        },
      ],
      [
        { type: 'failed' },
        {
          en: 'Could not save the purchase order. Check your connection and try again.',
          ja: '発注を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      ],
    ],
  )('should say what came of %o', (outcome, message) => {
    // Assert
    expect(afterOrderChange(outcome)).toEqual({ message, errors: {} })
  })
})
