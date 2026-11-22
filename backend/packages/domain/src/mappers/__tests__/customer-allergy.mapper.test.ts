import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../__tests__/fixtures/auth-fixtures'
import {
  apiCustomerAllergy,
  CUSTOMER_ALLERGY_ID,
  customerAllergyCreateRequest,
  dbCustomerAllergy,
  OTHER_CUSTOMER_ALLERGY_ID,
} from '../../__tests__/fixtures/customer-allergy-fixtures'
import { customerIdSchema } from '../../models/customer'
import { customerAllergyIdSchema } from '../../models/customer-allergy'
import { customerAllergyCreateRequestSchema } from '../../schemas/customer-allergy.schema'
import { CustomerAllergyReadMapper } from '../read/customer-allergy.mapper'
import { CustomerAllergyWriteMapper } from '../write/customer-allergy.mapper'

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

describe('CustomerAllergyReadMapper', () => {
  it('shows every column but the customer under its name, the times in ISO 8601', () => {
    expect(
      CustomerAllergyReadMapper.toApiCustomerAllergy(dbCustomerAllergy()),
    ).toEqual(Result.success(apiCustomerAllergy))
  })

  it('shows what is null as null', () => {
    expect(
      CustomerAllergyReadMapper.toApiCustomerAllergy(
        dbCustomerAllergy({
          symptoms: null,
          notes: null,
          confirmedDate: null,
          allergyType: 'latex',
          severityType: 'mild',
        }),
      ),
    ).toEqual(
      Result.success({
        ...apiCustomerAllergy,
        symptoms: null,
        notes: null,
        confirmedDate: null,
        allergyType: 'latex',
        severityType: 'mild',
      }),
    )
  })

  it('tells a stored allergy whose time cannot be read does not match the model', () => {
    expect(
      CustomerAllergyReadMapper.toApiCustomerAllergy(
        dbCustomerAllergy({ updatedAt: 'yesterday' }),
      ),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored customer allergy ${CUSTOMER_ALLERGY_ID} does not match the API model`,
      },
    })
  })

  it('shows allergies in their order, and stops at the first that does not match', () => {
    const other = dbCustomerAllergy({ id: OTHER_CUSTOMER_ALLERGY_ID })

    expect(
      CustomerAllergyReadMapper.toApiCustomerAllergies([
        other,
        dbCustomerAllergy(),
      ]),
    ).toEqual(
      Result.success([
        { ...apiCustomerAllergy, id: OTHER_CUSTOMER_ALLERGY_ID },
        apiCustomerAllergy,
      ]),
    )
    expect(
      CustomerAllergyReadMapper.toApiCustomerAllergies([
        dbCustomerAllergy(),
        dbCustomerAllergy({
          id: OTHER_CUSTOMER_ALLERGY_ID,
          createdAt: 'now',
        }),
      ]),
    ).toMatchObject({
      type: 'error',
      error: {
        message: `Stored customer allergy ${OTHER_CUSTOMER_ALLERGY_ID} does not match the API model`,
      },
    })
  })
})

describe('CustomerAllergyWriteMapper', () => {
  it('writes every item of an addition under its column', () => {
    const request = customerAllergyCreateRequestSchema.parse(
      customerAllergyCreateRequest(),
    )

    expect(CustomerAllergyWriteMapper.fromCreateRequest(request)).toEqual(
      customerAllergyCreateRequest(),
    )
  })

  it('writes what an update names, and nothing else', () => {
    expect(
      CustomerAllergyWriteMapper.fromUpdateRequest({
        symptoms: null,
        allergenName: 'ニッケル',
      }),
    ).toEqual({ symptoms: null, allergenName: 'ニッケル' })
  })
})
