import { describe, expect, it } from 'vitest'
import { PaymentMethodReadMapper } from '../mappers/read/payment-method.mapper'
import { PaymentMethodWriteMapper } from '../mappers/write/payment-method.mapper'
import { SALON_ID } from './fixtures'
import {
  dbPaymentMethod,
  OTHER_PAYMENT_METHOD_ID,
  PAYMENT_METHOD_ID,
  paymentMethodCreateRequest,
} from './payment-method-fixtures'

describe('PaymentMethodReadMapper', () => {
  it('returns the columns under their names, the fee as a number and the timestamps as ISO 8601, without the settings of a processor', () => {
    const result = PaymentMethodReadMapper.toApiPaymentMethod(dbPaymentMethod())

    expect(result).toStrictEqual({
      type: 'success',
      data: {
        id: PAYMENT_METHOD_ID,
        salonId: SALON_ID,
        method: 'credit_card',
        displayName: 'クレジットカード',
        description: null,
        processorName: 'Stripe',
        fee: 3.6,
        minimumAmount: 1000,
        maximumAmount: null,
        isOnlineEnabled: false,
        isOfflineEnabled: true,
        sortOrder: 2,
        isActive: true,
        createdAt: '2026-11-14T09:00:00.123Z',
        updatedAt: '2026-11-14T09:30:00.000Z',
      },
    })
  })

  it('returns every column that is set as it is stored', () => {
    const result = PaymentMethodReadMapper.toApiPaymentMethod(
      dbPaymentMethod({
        method: 'bank_transfer',
        description: '前払い',
        processorName: null,
        fee: '0.00',
        minimumAmount: null,
        maximumAmount: 20000,
        isOnlineEnabled: true,
        isOfflineEnabled: false,
        sortOrder: 0,
        isActive: false,
      }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        method: 'bank_transfer',
        description: '前払い',
        processorName: null,
        fee: 0,
        minimumAmount: null,
        maximumAmount: 20000,
        isOnlineEnabled: true,
        isOfflineEnabled: false,
        sortOrder: 0,
        isActive: false,
      },
    })
  })

  it.each([
    ['3.25', 3.25],
    ['100.00', 100],
    ['0.01', 0.01],
  ])('reads the fee %s as %d', (stored, fee) => {
    const result = PaymentMethodReadMapper.toApiPaymentMethod(
      dbPaymentMethod({ fee: stored }),
    )

    expect(result).toMatchObject({ type: 'success', data: { fee } })
  })

  it('keeps a fee that was not noted as null, which is not a fee of 0', () => {
    const result = PaymentMethodReadMapper.toApiPaymentMethod(
      dbPaymentMethod({ fee: null }),
    )

    expect(result).toMatchObject({ type: 'success', data: { fee: null } })
  })

  it.each([
    ['createdAt', { createdAt: 'yesterday' }],
    ['updatedAt', { updatedAt: '' }],
  ])(
    'reports a stored %s that is not a time as a database error that names the payment method',
    (_column, overrides) => {
      const result = PaymentMethodReadMapper.toApiPaymentMethod(
        dbPaymentMethod(overrides),
      )

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored payment method ${PAYMENT_METHOD_ID} does not match the API model`,
        },
      })
    },
  )

  it('maps a list in its order', () => {
    const result = PaymentMethodReadMapper.toApiPaymentMethods([
      dbPaymentMethod({ id: OTHER_PAYMENT_METHOD_ID, sortOrder: 1 }),
      dbPaymentMethod(),
    ])

    expect(result).toMatchObject({
      type: 'success',
      data: [{ id: OTHER_PAYMENT_METHOD_ID }, { id: PAYMENT_METHOD_ID }],
    })
  })

  it('maps an empty list to an empty list', () => {
    expect(PaymentMethodReadMapper.toApiPaymentMethods([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('fails for the whole list when one row cannot be read, and names that row', () => {
    const result = PaymentMethodReadMapper.toApiPaymentMethods([
      dbPaymentMethod(),
      dbPaymentMethod({ id: OTHER_PAYMENT_METHOD_ID, updatedAt: 'never' }),
    ])

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored payment method ${OTHER_PAYMENT_METHOD_ID} does not match the API model`,
      },
    })
  })
})

describe('PaymentMethodWriteMapper', () => {
  it('writes a new payment method as it was stated, the fee as text', () => {
    expect(
      PaymentMethodWriteMapper.fromCreateRequest(paymentMethodCreateRequest()),
    ).toStrictEqual({ ...paymentMethodCreateRequest(), fee: '3.6' })
  })

  it('keeps a fee that is not noted as null', () => {
    expect(
      PaymentMethodWriteMapper.fromCreateRequest({
        ...paymentMethodCreateRequest(),
        fee: null,
      }),
    ).toStrictEqual({ ...paymentMethodCreateRequest(), fee: null })
  })

  it.each([
    [0, '0'],
    [100, '100'],
    [0.01, '0.01'],
    [3.25, '3.25'],
  ])('writes the fee %d as %s', (fee, written) => {
    expect(
      PaymentMethodWriteMapper.fromCreateRequest({
        ...paymentMethodCreateRequest(),
        fee,
      }).fee,
    ).toBe(written)
  })

  it('turns the properties of an update into changes, and nothing else', () => {
    expect(
      PaymentMethodWriteMapper.fromUpdateRequest({
        displayName: 'カード',
        isActive: false,
      }),
    ).toStrictEqual({ displayName: 'カード', isActive: false })
  })

  it('writes the fee of an update as text, and a fee that is taken away as null', () => {
    expect(
      PaymentMethodWriteMapper.fromUpdateRequest({ fee: 2.95 }),
    ).toStrictEqual({ fee: '2.95' })
    expect(
      PaymentMethodWriteMapper.fromUpdateRequest({ fee: null }),
    ).toStrictEqual({ fee: null })
  })

  it('changes everything an update can name', () => {
    const { method: _method, ...everything } = paymentMethodCreateRequest()

    expect(
      PaymentMethodWriteMapper.fromUpdateRequest(everything),
    ).toStrictEqual({ ...everything, fee: '3.6' })
  })
})
