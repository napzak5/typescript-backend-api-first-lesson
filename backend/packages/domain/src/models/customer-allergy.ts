import type { customerAllergies } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import {
  customerAllergyMessages,
  customerMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'
import { type CustomerId, customerIdSchema } from './customer'

// ID: a UUID that has been checked.
export const customerAllergyIdSchema = uuidSchema.brand<'CustomerAllergyId'>()
export type CustomerAllergyId = z.infer<typeof customerAllergyIdSchema>

const allergyCustomerParameterSchema = z.object({
  customerId: customerIdSchema,
})

/** The customer of a path whose allergies are read or added. */
export const parseAllergyCustomerId = (
  customerId: unknown,
): Result<CustomerId, DomainError> =>
  Result.map(
    parseWith(
      allergyCustomerParameterSchema,
      { customerId },
      customerMessages.invalidCustomerId,
    ),
    (parameters) => parameters.customerId,
  )

const customerAllergyParametersSchema = z.object({
  customerId: customerIdSchema,
  allergyId: customerAllergyIdSchema,
})

/** The customer and the allergy of a path, the customer first. */
export const parseCustomerAllergyIds = (
  customerId: unknown,
  allergyId: unknown,
): Result<
  { customerId: CustomerId; allergyId: CustomerAllergyId },
  DomainError
> =>
  parseWith(
    customerAllergyParametersSchema,
    { customerId, allergyId },
    customerAllergyMessages.invalidCustomerAllergyId,
  )

// API types, generated from TypeSpec
export type ApiCustomerAllergyResponse =
  components['schemas']['Models.CustomerAllergyResponse']
export type ApiCustomerAllergyCreateRequest =
  components['schemas']['Models.CustomerAllergyCreateRequest']
export type ApiCustomerAllergyUpdateRequest =
  components['schemas']['Models.CustomerAllergyUpdateRequest']
export type ApiCustomerAllergySearchRequest = NonNullable<
  operations['MedicalChartCrud_listAllergies']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbCustomerAllergy = DeepRequired<
  typeof customerAllergies.$inferSelect
>

/**
 * What a request writes of an allergy: the database assigns the ID and the
 * times, and the customer is the one of the path.
 */
export type DbNewCustomerAllergy = DeepRequired<
  Omit<
    typeof customerAllergies.$inferInsert,
    'id' | 'customerId' | 'createdAt' | 'updatedAt'
  >
>

/** What an update can write of an allergy. */
export type DbCustomerAllergyChanges = Partial<DbNewCustomerAllergy>
