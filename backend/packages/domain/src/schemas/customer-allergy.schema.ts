import {
  AllergySeverityTypeSchema,
  AllergyTypeSchema,
} from '@beauty-salon-backend/generated'
import { z } from 'zod'
import {
  type ApiCustomerAllergyCreateRequest,
  type ApiCustomerAllergySearchRequest,
  type ApiCustomerAllergyUpdateRequest,
  customerAllergyIdSchema,
} from '../models/customer-allergy'
import { atLeastOneProperty, calendarDate, nonBlankText } from './rules'

/**
 * Validation of the requests about the allergies of a customer. The shapes
 * are checked against the generated API types and the remaining rules are
 * business rules. Whether the allergy was confirmed in the past needs the
 * current time, and is looked at by the use case
 * (`customerAllergyRuleIssues`); whether the customer is there and has no
 * allergy of that allergen yet, where the allergy is written.
 */

const allergyProperties = {
  allergyType: AllergyTypeSchema,
  allergenName: nonBlankText.max(255),
  severityType: AllergySeverityTypeSchema,
  symptoms: nonBlankText.nullable(),
  notes: nonBlankText.nullable(),
  confirmedDate: calendarDate.nullable(),
}

export const customerAllergyCreateRequestSchema = z.strictObject(
  allergyProperties,
) satisfies z.ZodType<ApiCustomerAllergyCreateRequest>

export type CustomerAllergyCreateRequest = z.infer<
  typeof customerAllergyCreateRequestSchema
>

export const customerAllergyUpdateRequestSchema = z
  .strictObject(allergyProperties)
  .exactPartial()
  .check(
    atLeastOneProperty,
  ) satisfies z.ZodType<ApiCustomerAllergyUpdateRequest>

export type CustomerAllergyUpdateRequest = z.infer<
  typeof customerAllergyUpdateRequestSchema
>

export const customerAllergySearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: customerAllergyIdSchema.exactOptional(),
}) satisfies z.ZodType<ApiCustomerAllergySearchRequest>

/** A search that was checked: its cursor is the ID of an allergy. */
export type CustomerAllergySearchRequest = z.infer<
  typeof customerAllergySearchRequestSchema
>
