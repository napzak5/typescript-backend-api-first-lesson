import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../__tests__/fixtures/auth-fixtures'
import {
  dbCustomerVersion,
  VERSION_ID,
} from '../../__tests__/fixtures/customer-version-fixtures'
import { RULES_BROKEN_BY_STORED } from '../../__tests__/fixtures/fixtures'
import { customerIdSchema } from '../../models/customer'
import { customerVersionIdSchema } from '../../models/customer-version'
import { CustomerVersionReadMapper } from '../read/customer-version.mapper'
import { CustomerVersionWriteMapper } from '../write/customer-version.mapper'

describe('CustomerVersionReadMapper.toApiHistoryPage', () => {
  it('answers with the versions of the list and where the history goes on', () => {
    const result = CustomerVersionReadMapper.toApiHistoryPage(
      {
        type: 'listed',
        versions: [
          {
            version: dbCustomerVersion({
              id: VERSION_ID(3),
              version: 3,
              operation: 'update',
            }),
            previous: dbCustomerVersion({ id: VERSION_ID(2), version: 2 }),
          },
          {
            version: dbCustomerVersion({
              id: VERSION_ID(2),
              version: 2,
              operation: 'update',
            }),
            previous: dbCustomerVersion(),
          },
        ],
        total: 4,
        hasMore: true,
      },
      { limit: 2, after: customerVersionIdSchema.parse(VERSION_ID(4)) },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: VERSION_ID(3) }, { id: VERSION_ID(2) }],
        meta: {
          total: 4,
          limit: 2,
          hasMore: true,
          cursor: VERSION_ID(4),
          nextCursor: VERSION_ID(2),
          prevCursor: null,
        },
      },
    })
  })

  it('fails as a whole when one stored version is invalid', () => {
    const result = CustomerVersionReadMapper.toApiHistoryPage(
      {
        type: 'listed',
        versions: [
          {
            version: dbCustomerVersion({ changedAt: 'yesterday' }),
            previous: null,
          },
        ],
        total: 1,
        hasMore: false,
      },
      { limit: 20, after: null },
    )

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored customer version ${VERSION_ID(1)} does not match the API model`,
        cause: RULES_BROKEN_BY_STORED,
      },
    })
  })
})

describe('CustomerVersionWriteMapper.fromSearchRequest', () => {
  const customerId = customerIdSchema.parse(CUSTOMER_ID)

  it('asks for the first 20 versions of the customer when the request names nothing', () => {
    expect(
      CustomerVersionWriteMapper.fromSearchRequest({}, customerId),
    ).toStrictEqual({ customerId: CUSTOMER_ID, limit: 20, after: null })
  })

  it('takes the place the request names', () => {
    expect(
      CustomerVersionWriteMapper.fromSearchRequest(
        { limit: 100, cursor: customerVersionIdSchema.parse(VERSION_ID(5)) },
        customerId,
      ),
    ).toStrictEqual({
      customerId: CUSTOMER_ID,
      limit: 100,
      after: VERSION_ID(5),
    })
  })
})
