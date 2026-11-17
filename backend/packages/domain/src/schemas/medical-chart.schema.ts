import { TreatmentTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import { customerIdSchema } from '../models/customer'
import {
  type ApiMedicalChartCreateRequest,
  type ApiMedicalChartSearchRequest,
  type ApiMedicalChartUpdateRequest,
  type ApiPreviousTreatment,
  medicalChartIdSchema,
} from '../models/medical-chart'
import {
  atLeastOneProperty,
  calendarDate,
  nonBlankText,
  noRepeatedEntries,
} from './rules'

/**
 * Validation of the requests about the medical charts of the customers. The
 * shapes are checked against the generated API types and the remaining
 * rules are business rules. Whether a previous treatment lies in the past
 * needs the current time, and is looked at by the use case
 * (`medicalChartRuleIssues`); whether the customer is there and has no
 * chart yet, where the chart is written.
 */

export const previousTreatmentSchema = z.strictObject({
  treatment: TreatmentTypeSchema,
  date: calendarDate,
  salonName: nonBlankText.max(255).nullable(),
  notes: nonBlankText.nullable(),
}) satisfies z.ZodType<ApiPreviousTreatment>

/** The treatments a customer had before, in the order the staff list them. */
const previousTreatments = z.array(previousTreatmentSchema).max(50)

/** The names of products or brands, each once. */
const productNames = z
  .array(nonBlankText.max(100))
  .max(50)
  .check(noRepeatedEntries)

export const medicalChartCreateRequestSchema = z.strictObject({
  customerId: customerIdSchema,
  previousTreatments,
  medicalConditions: nonBlankText.nullable(),
  preferredProducts: productNames,
  avoidProducts: productNames,
  notes: nonBlankText.nullable(),
}) satisfies z.ZodType<ApiMedicalChartCreateRequest>

export type MedicalChartCreateRequest = z.infer<
  typeof medicalChartCreateRequestSchema
>

export const medicalChartUpdateRequestSchema = z
  .strictObject({
    previousTreatments,
    medicalConditions: nonBlankText.nullable(),
    preferredProducts: productNames,
    avoidProducts: productNames,
    notes: nonBlankText.nullable(),
  })
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiMedicalChartUpdateRequest>

export type MedicalChartUpdateRequest = z.infer<
  typeof medicalChartUpdateRequestSchema
>

export const medicalChartSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: medicalChartIdSchema.exactOptional(),
  search: nonBlankText.max(100).exactOptional(),
  hasAllergies: z.boolean().exactOptional(),
}) satisfies z.ZodType<ApiMedicalChartSearchRequest>
