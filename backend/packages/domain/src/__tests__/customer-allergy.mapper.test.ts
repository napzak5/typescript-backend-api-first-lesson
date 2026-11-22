import { describe, expect, it } from 'vitest'
import { CustomerAllergyReadMapper } from '../mappers/read/customer-allergy.mapper'
import { CustomerAllergyWriteMapper } from '../mappers/write/customer-allergy.mapper'
import { customerIdSchema } from '../models/customer'
import { customerAllergyIdSchema } from '../models/customer-allergy'
import { CUSTOMER_ID } from './auth-fixtures'
import {
  CUSTOMER_ALLERGY_ID,
  dbCustomerAllergy,
  OTHER_CUSTOMER_ALLERGY_ID,
} from './customer-allergy-fixtures'

describe('CustomerAllergyReadMapper.toApiCustomerAllergyPage', () => {
  it('answers with the allergies of the list and where the list goes on', () => {
    const result = CustomerAllergyReadMapper.toApiCustomerAllergyPage(
      {
        type: 'listed',
        allergies: [
          dbCustomerAllergy(),
          dbCustomerAllergy({ id: OTHER_CUSTOMER_ALLERGY_ID }),
        ],
        total: 3,
        hasMore: true,
      },
      { limit: 2, after: null },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: CUSTOMER_ALLERGY_ID }, { id: OTHER_CUSTOMER_ALLERGY_ID }],
        meta: {
          total: 3,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: OTHER_CUSTOMER_ALLERGY_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('fails as a whole when one stored allergy is invalid', () => {
    const result = CustomerAllergyReadMapper.toApiCustomerAllergyPage(
      {
        type: 'listed',
        allergies: [dbCustomerAllergy({ updatedAt: 'recently' })],
        total: 1,
        hasMore: false,
      },
      { limit: 20, after: null },
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('CustomerAllergyWriteMapper.fromSearchRequest', () => {
  const customerId = customerIdSchema.parse(CUSTOMER_ID)

  it('asks for the first 20 allergies of the customer when the request names nothing', () => {
    expect(
      CustomerAllergyWriteMapper.fromSearchRequest({}, customerId),
    ).toStrictEqual({ customerId: CUSTOMER_ID, limit: 20, after: null })
  })

  it('takes the place the request names', () => {
    expect(
      CustomerAllergyWriteMapper.fromSearchRequest(
        {
          limit: 4,
          cursor: customerAllergyIdSchema.parse(CUSTOMER_ALLERGY_ID),
        },
        customerId,
      ),
    ).toStrictEqual({
      customerId: CUSTOMER_ID,
      limit: 4,
      after: CUSTOMER_ALLERGY_ID,
    })
  })
})
