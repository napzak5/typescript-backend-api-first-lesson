import type { ModelsInventoryTransactionType } from '@beauty-salon-frontend/api-client'
import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { colour, shampoo } from '../../products/components/examples'
import { colourLot, shampooRow } from '../components/examples'
import { afterMovementRecord, readMovement } from './movement-form'
import { recordedKindsOf } from './movement-format'

/** The form of a movement, as a browser sends it */
const movementForm = (values: {
  transactionType?: string
  direction?: string
  quantity?: string
  unitCost?: string
  reason?: string
}): FormData =>
  formOfEntries(
    Object.entries({ quantity: '', unitCost: '', reason: '', ...values }),
  )

const EVERY_KIND = recordedKindsOf(true)
const EVERY_DAY = recordedKindsOf(false)

const QUANTITY_ERROR = {
  en: 'Enter the quantity as a number from 0.01 to 99,999,999.99 (up to 2 decimal places).',
  ja: '数量は、0.01 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
}

describe('readMovement', () => {
  it.each<[string, Parameters<typeof movementForm>[0], number]>([
    ['a purchase in', { transactionType: 'purchase', quantity: '10' }, 10],
    ['a use out', { transactionType: 'use', quantity: '2.5' }, -2.5],
    ['a sale out', { transactionType: 'sale', quantity: '1' }, -1],
    [
      'a disposal out',
      { transactionType: 'disposal', quantity: '0.5', reason: '容器の破損' },
      -0.5,
    ],
    [
      'a return to the supplier out',
      { transactionType: 'return', direction: 'out', quantity: '3' },
      -3,
    ],
    [
      'a return of a customer in',
      { transactionType: 'return', direction: 'in', quantity: '1' },
      1,
    ],
    [
      'a transfer in',
      { transactionType: 'transfer', direction: 'in', quantity: '4' },
      4,
    ],
    [
      'the whole of what may be taken out',
      { transactionType: 'use', quantity: '12' },
      -12,
    ],
    [
      'digits of full width and commas',
      { transactionType: 'purchase', quantity: '１,２００.５' },
      1200.5,
    ],
  ])('should send %s with its sign', (_, values, quantity) => {
    expect(
      readMovement(movementForm(values), colourLot, colour, EVERY_KIND),
    ).toEqual({
      type: 'valid',
      value: {
        inventoryId: colourLot.id,
        transactionType: values.transactionType,
        quantity,
        unitCost: null,
        referenceType: null,
        referenceId: null,
        reason: values.reason ?? null,
      },
    })
  })

  it('should send what one unit cost, and why, without the spaces around it', () => {
    expect(
      readMovement(
        movementForm({
          transactionType: 'adjustment',
          direction: 'in',
          quantity: '2',
          unitCost: '１,２００',
          reason: '  数え直したら多かった  ',
        }),
        colourLot,
        colour,
        EVERY_KIND,
      ),
    ).toMatchObject({
      type: 'valid',
      value: { quantity: 2, unitCost: 1200, reason: '数え直したら多かった' },
    })
  })

  it.each<
    [string, Parameters<typeof movementForm>[0], Record<string, LocalizedText>]
  >([
    [
      'no kind',
      { quantity: '1' },
      {
        transactionType: {
          en: 'Choose the kind.',
          ja: '区分を選んでください。',
        },
      },
    ],
    [
      'no way for a kind that moves either way',
      { transactionType: 'return', quantity: '1' },
      {
        direction: {
          en: 'Choose whether the stock goes up or down.',
          ja: '在庫が増えるか、減るかを選んでください。',
        },
      },
    ],
    [
      'no quantity',
      { transactionType: 'purchase' },
      { quantity: QUANTITY_ERROR },
    ],
    [
      'a quantity of 0',
      { transactionType: 'purchase', quantity: '0' },
      { quantity: QUANTITY_ERROR },
    ],
    [
      'a quantity of three decimals',
      { transactionType: 'purchase', quantity: '1.005' },
      { quantity: QUANTITY_ERROR },
    ],
    [
      'a quantity with a sign',
      { transactionType: 'use', quantity: '-1' },
      { quantity: QUANTITY_ERROR },
    ],
    [
      'more out than may be taken',
      { transactionType: 'use', quantity: '12.01' },
      {
        quantity: {
          en: 'At most 12 本 is available to take out.',
          ja: '減らせるのは、使える数の 12 本 までです。',
        },
      },
    ],
    [
      'more in than a row holds',
      { transactionType: 'purchase', quantity: '99,999,988' },
      {
        quantity: {
          en: 'Recording this would take the stock above 99,999,999.99. Check the quantity.',
          ja: '記録すると、在庫数が 99,999,999.99 を超えます。数量を確かめてください。',
        },
      },
    ],
    [
      'a cost that is no amount',
      { transactionType: 'purchase', quantity: '1', unitCost: '12.5' },
      {
        unitCost: {
          en: 'Enter the unit cost as a whole number of yen, 0 or more.',
          ja: '単価は、0 以上の円の整数で入力してください。',
        },
      },
    ],
    [
      'a cost whose amount is too large',
      {
        transactionType: 'purchase',
        quantity: '2',
        unitCost: '1,073,741,824',
      },
      {
        unitCost: {
          en: 'The amount (unit cost × quantity) is more than 2,147,483,647 yen. Check the unit cost and the quantity.',
          ja: '金額（単価 × 数量）が 2,147,483,647 円を超えます。単価と数量を確かめてください。',
        },
      },
    ],
    [
      'an adjustment that says not why',
      {
        transactionType: 'adjustment',
        direction: 'out',
        quantity: '1',
        reason: '   ',
      },
      {
        reason: {
          en: 'For an adjustment and a disposal, enter the reason.',
          ja: '在庫の調整と廃棄では、理由を入力してください。',
        },
      },
    ],
    [
      'a disposal that says not why',
      { transactionType: 'disposal', quantity: '1' },
      {
        reason: {
          en: 'For an adjustment and a disposal, enter the reason.',
          ja: '在庫の調整と廃棄では、理由を入力してください。',
        },
      },
    ],
  ])('should say %s, and send nothing', (_, values, errors) => {
    expect(
      readMovement(movementForm(values), colourLot, colour, EVERY_KIND),
    ).toEqual({ type: 'invalid', errors })
  })

  it('should send a cost whose amount is the most a movement holds', () => {
    expect(
      readMovement(
        movementForm({
          transactionType: 'purchase',
          quantity: '1',
          unitCost: '2,147,483,647',
        }),
        colourLot,
        colour,
        EVERY_KIND,
      ),
    ).toMatchObject({ type: 'valid', value: { unitCost: 2_147_483_647 } })
  })

  it('should take out no more than what is not reserved', () => {
    expect(
      readMovement(
        movementForm({ transactionType: 'use', quantity: '6.01' }),
        shampooRow,
        shampoo,
        EVERY_DAY,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        quantity: {
          en: 'At most 6 本 is available to take out.',
          ja: '減らせるのは、使える数の 6 本 までです。',
        },
      },
    })
    expect(
      readMovement(
        movementForm({ transactionType: 'use', quantity: '6' }),
        shampooRow,
        shampoo,
        EVERY_DAY,
      ),
    ).toMatchObject({ type: 'valid', value: { quantity: -6 } })
  })

  it.each<ModelsInventoryTransactionType>([
    'adjustment',
    'disposal',
    'transfer',
  ])(
    'should send no %s for an account that records only the kinds of every day',
    (transactionType) => {
      expect(
        readMovement(
          movementForm({
            transactionType,
            direction: 'out',
            quantity: '1',
            reason: '数え直した',
          }),
          colourLot,
          colour,
          EVERY_DAY,
        ),
      ).toEqual({
        type: 'invalid',
        errors: {
          transactionType: {
            en: 'Choose the kind.',
            ja: '区分を選んでください。',
          },
        },
      })
    },
  )
})

describe('afterMovementRecord', () => {
  it('should say at the controls what the API refused', () => {
    expect(
      afterMovementRecord(
        {
          type: 'invalid',
          values: [
            { field: 'quantity', rule: 'custom' },
            { field: 'unitCost', rule: 'too_big' },
            { field: 'reason', rule: 'custom' },
          ],
        },
        -1,
      ),
    ).toEqual({
      message: undefined,
      errors: {
        quantity: QUANTITY_ERROR,
        unitCost: {
          en: 'The amount (unit cost × quantity) is more than 2,147,483,647 yen. Check the unit cost and the quantity.',
          ja: '金額（単価 × 数量）が 2,147,483,647 円を超えます。単価と数量を確かめてください。',
        },
        reason: {
          en: 'For an adjustment and a disposal, enter the reason.',
          ja: '在庫の調整と廃棄では、理由を入力してください。',
        },
      },
    })
  })

  it('should say at the kind and at the unit cost what each takes', () => {
    expect(
      afterMovementRecord(
        {
          type: 'invalid',
          values: [
            { field: 'transactionType', rule: 'invalid' },
            { field: 'unitCost', rule: 'too_small' },
          ],
        },
        1,
      ),
    ).toEqual({
      message: undefined,
      errors: {
        transactionType: {
          en: 'Choose the kind.',
          ja: '区分を選んでください。',
        },
        unitCost: {
          en: 'Enter the unit cost as a whole number of yen, 0 or more.',
          ja: '単価は、0 以上の円の整数で入力してください。',
        },
      },
    })
  })

  it('should say above the form what it has no control for', () => {
    expect(
      afterMovementRecord(
        { type: 'invalid', values: [{ field: 'referenceId', rule: 'custom' }] },
        1,
      ),
    ).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {},
    })
  })

  it.each<[string, number, LocalizedText]>([
    [
      'out, that the stock would fall below what is reserved',
      -3,
      {
        en: 'Recording this would take the stock below what is reserved: the stock changed meanwhile. Check the stock that was loaded again, and try again.',
        ja: '記録すると、在庫数が、引き当てた数を下回ります。その間に在庫数が変わりました。読み直した在庫数を確かめて、もう一度お試しください。',
      },
    ],
    [
      'in, that the stock would go above what a row holds',
      3,
      {
        en: 'Recording this would take the stock above 99,999,999.99. Check the quantity.',
        ja: '記録すると、在庫数が 99,999,999.99 を超えます。数量を確かめてください。',
      },
    ],
  ])(
    'should say at the quantity of a movement %s',
    (_, sentQuantity, message) => {
      expect(afterMovementRecord({ type: 'outOfRange' }, sentQuantity)).toEqual(
        { message: undefined, errors: { quantity: message } },
      )
    },
  )

  it.each<[string, Parameters<typeof afterMovementRecord>[0], LocalizedText]>([
    [
      'the account',
      { type: 'forbidden' },
      {
        en: 'This account cannot record this stock movement. Only the owners and managers of the salon, and administrators, can record adjustments, disposals and transfers between salons.',
        ja: 'このアカウントでは、この在庫の移動を記録できません。在庫の調整、廃棄、サロン間の移動を記録できるのは、サロンのオーナーとマネージャーと、管理者です。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'a failure',
      { type: 'failed' },
      {
        en: 'The stock movement could not be recorded. Check your connection and try again.',
        ja: '在庫の移動を記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say above the form why %s was refused', (_, outcome, message) => {
    expect(afterMovementRecord(outcome, 1)).toEqual({ message, errors: {} })
  })
})
