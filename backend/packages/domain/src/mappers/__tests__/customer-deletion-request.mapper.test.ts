import { describe, expect, it } from 'vitest'
import {
  apiCustomerDeletionRequest,
  CUSTOMER_DELETION_REQUEST_ID,
  dbCustomerDeletionRequest,
} from '../../__tests__/fixtures/customer-deletion-request-fixtures'
import { RULES_BROKEN_BY_STORED } from '../../__tests__/fixtures/fixtures'
import type { DbCustomerDeletionRequest } from '../../models/customer-deletion-request'
import { CustomerDeletionRequestReadMapper } from '../read/customer-deletion-request.mapper'
import { CustomerDeletionRequestWriteMapper } from '../write/customer-deletion-request.mapper'

describe('CustomerDeletionRequestReadMapper.toApiCustomerDeletionRequest', () => {
  it('should return every column under its own name, with the times in ISO 8601 UTC', () => {
    // Act
    const result =
      CustomerDeletionRequestReadMapper.toApiCustomerDeletionRequest(
        dbCustomerDeletionRequest(),
      )

    // Assert
    expect(result).toStrictEqual({
      type: 'success',
      data: apiCustomerDeletionRequest(),
    })
  })

  it.each<[string, Partial<DbCustomerDeletionRequest>]>([
    ['a time of the request that is none', { requestedAt: 'yesterday' }],
    ['a time it is scheduled for that is none', { scheduledAt: '' }],
    ['a time of cancellation that is none', { cancelledAt: 'x' }],
    ['a time of completion that is none', { completedAt: 'x' }],
  ])(
    'should report %s as a database error that names the request, not as a bad request',
    (_case, stored) => {
      // Act
      const result =
        CustomerDeletionRequestReadMapper.toApiCustomerDeletionRequest(
          dbCustomerDeletionRequest(stored),
        )

      // Assert
      expect(result).toEqual({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored customer deletion request ${CUSTOMER_DELETION_REQUEST_ID} does not match the API model`,
          cause: RULES_BROKEN_BY_STORED,
        },
      })
    },
  )
})

describe('CustomerDeletionRequestWriteMapper.fromCreateRequest', () => {
  it('takes the reason as it is written', () => {
    expect(
      CustomerDeletionRequestWriteMapper.fromCreateRequest({
        reason: '  引っ越しのため、データの消去を希望します  ',
      }),
    ).toStrictEqual({ reason: '  引っ越しのため、データの消去を希望します  ' })
  })
})
