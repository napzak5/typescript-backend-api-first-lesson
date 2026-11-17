import { z } from 'zod'
import { bookingIdSchema } from '../models/booking'
import { customerIdSchema } from '../models/customer'
import { productIdSchema } from '../models/product'
import { salonIdSchema } from '../models/salon'
import { serviceIdSchema } from '../models/service'
import { staffIdSchema } from '../models/staff'
import {
  type ApiTreatmentMaterial,
  type ApiTreatmentRecordCreateRequest,
  type ApiTreatmentRecordSearchRequest,
  type ApiTreatmentRecordUpdateRequest,
  treatmentRecordIdSchema,
} from '../models/treatment-record'
import {
  atLeastOneProperty,
  calendarDate,
  momentInUtc,
  nonBlankText,
  noRepeatedEntries,
} from './rules'

/**
 * Validation of the requests about the treatment records of the bookings
 * of salons. The shapes are checked against the generated API types, the
 * limits are those of the database columns, and the remaining rules are
 * business rules.
 *
 * A record is held here to what it is by itself. Whether what it names is
 * of the salon of its booking (`creationIssues`, `treatmentIssues`), and
 * whether the booking takes a record (`isTreated`), is looked at where it
 * is written.
 */

/** The most of a material a record states, as a `numeric(10, 2)` column holds. */
const MAX_QUANTITY = 99_999_999.99

const materialSchema = z.strictObject({
  productId: productIdSchema,
  quantity: z.number().gt(0).max(MAX_QUANTITY).multipleOf(0.01),
  unit: nonBlankText.max(20),
  lotNumber: nonBlankText.max(100).nullable(),
  notes: nonBlankText.nullable(),
}) satisfies z.ZodType<ApiTreatmentMaterial>

/** The services of a treatment: some, each once. */
const services = z
  .array(serviceIdSchema)
  .min(1)
  .max(20)
  .check(noRepeatedEntries)

/** The names of the techniques a treatment used, each once. */
const techniques = z
  .array(nonBlankText.max(100))
  .max(20)
  .check(noRepeatedEntries)

/** The services recommended for the next visit, each once. */
const nextRecommendedServices = z
  .array(serviceIdSchema)
  .max(20)
  .check(noRepeatedEntries)

/** The materials, in the order a record keeps them. */
const materials = z.array(materialSchema).max(50)

/** How long the treatment took, in minutes: no treatment takes longer than a day. */
const processingTime = z.number().int().min(0).max(1440)

const customerSatisfaction = z.number().int().min(1).max(5)

export const treatmentRecordCreateRequestSchema = z.strictObject({
  bookingId: bookingIdSchema,
  customerId: customerIdSchema,
  staffId: staffIdSchema,
  services,
  techniques,
  consultationNotes: nonBlankText.nullable(),
  scalpCondition: nonBlankText.nullable(),
  hairCondition: nonBlankText.nullable(),
  colorFormula: nonBlankText.nullable(),
  processingTime: processingTime.nullable(),
  resultNotes: nonBlankText.nullable(),
  nextRecommendedDate: calendarDate.nullable(),
  nextRecommendedServices,
  homeCareSuggestions: nonBlankText.nullable(),
  customerSatisfaction: customerSatisfaction.nullable(),
  staffEvaluation: nonBlankText.nullable(),
  materials,
}) satisfies z.ZodType<ApiTreatmentRecordCreateRequest>

/** A record that passed the rules of its own. */
export type TreatmentRecordCreateRequest = z.infer<
  typeof treatmentRecordCreateRequestSchema
>

export const treatmentRecordUpdateRequestSchema = z
  .strictObject({
    services,
    techniques,
    consultationNotes: nonBlankText.nullable(),
    scalpCondition: nonBlankText.nullable(),
    hairCondition: nonBlankText.nullable(),
    colorFormula: nonBlankText.nullable(),
    processingTime: processingTime.nullable(),
    resultNotes: nonBlankText.nullable(),
    nextRecommendedDate: calendarDate.nullable(),
    nextRecommendedServices,
    homeCareSuggestions: nonBlankText.nullable(),
    customerSatisfaction: customerSatisfaction.nullable(),
    staffEvaluation: nonBlankText.nullable(),
    materials,
  })
  .exactPartial()
  .check(
    atLeastOneProperty,
  ) satisfies z.ZodType<ApiTreatmentRecordUpdateRequest>

export type TreatmentRecordUpdateRequest = z.infer<
  typeof treatmentRecordUpdateRequestSchema
>

/** Two moments in the spelling of `toISOString` compare as text. */
export const treatmentRecordSearchRequestSchema = z
  .strictObject({
    limit: z.number().int().min(1).max(100).exactOptional(),
    cursor: treatmentRecordIdSchema.exactOptional(),
    salonId: salonIdSchema.exactOptional(),
    customerId: customerIdSchema.exactOptional(),
    staffId: staffIdSchema.exactOptional(),
    startDate: momentInUtc.exactOptional(),
    endDate: momentInUtc.exactOptional(),
  })
  .refine(
    ({ startDate, endDate }) =>
      startDate === undefined || endDate === undefined || startDate <= endDate,
    { path: ['endDate'], message: 'Must not be earlier than startDate' },
  ) satisfies z.ZodType<ApiTreatmentRecordSearchRequest>
