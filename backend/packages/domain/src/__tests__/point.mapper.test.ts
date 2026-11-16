import { describe, expect, it } from 'vitest'
import { PointReadMapper } from '../mappers/read/point.mapper'
import { BOOKING_ID } from './booking-fixtures'
import {
  apiPointTransaction,
  dbPointTransaction,
  OTHER_POINT_TRANSACTION_ID,
  POINT_TRANSACTION_ID,
} from './point-fixtures'

describe('PointReadMapper.toApiPointTransaction', () => {
  it('returns every column under its own name, the time in ISO 8601', () => {
    expect(PointReadMapper.toApiPointTransaction(dbPointTransaction())).toEqual(
      { type: 'success', data: apiPointTransaction() },
    )
  })

  it('returns a transaction without a record and without an expiry date', () => {
    const transaction = dbPointTransaction({
      transactionType: 'used',
      points: -500,
      balance: 0,
      description: null,
      referenceType: null,
      referenceId: null,
      expiryDate: null,
    })

    expect(PointReadMapper.toApiPointTransaction(transaction)).toEqual({
      type: 'success',
      data: apiPointTransaction({
        transactionType: 'used',
        points: -500,
        balance: 0,
        description: null,
        referenceType: null,
        referenceId: null,
        expiryDate: null,
      }),
    })
  })

  it('returns a booking as the record', () => {
    expect(
      PointReadMapper.toApiPointTransaction(
        dbPointTransaction({
          referenceType: 'booking',
          referenceId: BOOKING_ID,
        }),
      ),
    ).toEqual({
      type: 'success',
      data: apiPointTransaction({
        referenceType: 'booking',
        referenceId: BOOKING_ID,
      }),
    })
  })

  it('reports a kind of record that the API does not know', () => {
    expect(
      PointReadMapper.toApiPointTransaction(
        dbPointTransaction({ referenceType: 'payment' }),
      ),
    ).toEqual({
      type: 'error',
      error: expect.objectContaining({
        type: 'database',
        message: `Stored point transaction ${POINT_TRANSACTION_ID} does not match the API model`,
      }),
    })
  })

  it('reports a time that is not one', () => {
    expect(
      PointReadMapper.toApiPointTransaction(
        dbPointTransaction({ createdAt: 'then' }),
      ),
    ).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('PointReadMapper.toApiPointTransactions', () => {
  it('returns the transactions in their order', () => {
    expect(
      PointReadMapper.toApiPointTransactions([
        dbPointTransaction({ id: OTHER_POINT_TRANSACTION_ID }),
        dbPointTransaction(),
      ]),
    ).toEqual({
      type: 'success',
      data: [
        apiPointTransaction({ id: OTHER_POINT_TRANSACTION_ID }),
        apiPointTransaction(),
      ],
    })
  })

  it('returns no transaction', () => {
    expect(PointReadMapper.toApiPointTransactions([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('reports the first transaction that does not fit the model', () => {
    expect(
      PointReadMapper.toApiPointTransactions([
        dbPointTransaction({ id: OTHER_POINT_TRANSACTION_ID }),
        dbPointTransaction({ referenceType: 'payment' }),
      ]),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored point transaction ${POINT_TRANSACTION_ID} does not match the API model`,
      },
    })
  })
})
