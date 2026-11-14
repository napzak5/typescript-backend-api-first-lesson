import {
  BookingRequirementTypeSchema,
  PricingStrategyTypeSchema,
  ServiceAvailabilityTypeSchema,
  ServiceOptionTypeSchema,
  ServiceStatusTypeSchema,
  StaffLevelTypeSchema,
} from '@beauty-salon-backend/generated'
import { z } from 'zod'
import {
  type ApiServiceBulkUpdateRequest,
  type ApiServiceCreateRequest,
  type ApiServiceOption,
  type ApiServiceSearchRequest,
  type ApiServiceUpdateRequest,
  serviceIdSchema,
} from '../models/service'
import { categoryIdSchema } from '../models/service-category'
import {
  atLeastOneProperty,
  MAX_INTEGER,
  nonBlankText,
  noRepeatedEntries,
} from './rules'

/**
 * Validation of service requests. The shapes are checked against the
 * generated API types, the limits are those of the database columns, and the
 * remaining rules are business rules. A rule that ties two properties
 * together (`serviceRuleIssues`) or that depends on what is stored (the
 * category, the member services of a package) is not checked here: an update
 * names only some properties, so such a rule is decided for the service as
 * it will be stored.
 */

/** A day, in minutes: no treatment takes longer. */
const MAX_DURATION = 1440

/** The most services a package combines. */
const MAX_PACKAGE_MEMBERS = 20

const columnInteger = (minimum: number) =>
  z.number().int().min(minimum).max(MAX_INTEGER)

const serviceOptionSchema = z.strictObject({
  name: nonBlankText.max(255),
  description: nonBlankText.nullable(),
  optionType: ServiceOptionTypeSchema,
  additionalTime: columnInteger(0),
  additionalPrice: columnInteger(0),
  maxQuantity: columnInteger(1),
  isRequired: z.boolean(),
  sortOrder: columnInteger(0),
  isActive: z.boolean(),
}) satisfies z.ZodType<ApiServiceOption>

export const serviceCreateRequestSchema = z.strictObject({
  categoryId: categoryIdSchema.nullable(),
  name: nonBlankText.max(255),
  description: nonBlankText.nullable(),
  shortDescription: nonBlankText.max(500).nullable(),
  duration: z.number().int().min(1).max(MAX_DURATION),
  price: columnInteger(0),
  discountPrice: columnInteger(0).nullable(),
  taxIncluded: z.boolean(),
  pricingStrategy: PricingStrategyTypeSchema,
  imageUrl: z.httpUrl().max(500).nullable(),
  imageUrls: z.array(z.httpUrl()),
  requiredStaffLevel: StaffLevelTypeSchema.nullable(),
  maxBookingsPerDay: columnInteger(1).nullable(),
  requiresConsultation: z.boolean(),
  allowOnlineBooking: z.boolean(),
  bookingRequirements: z
    .array(BookingRequirementTypeSchema)
    .check(noRepeatedEntries),
  isPackage: z.boolean(),
  packageServiceIds: z
    .array(serviceIdSchema)
    .max(MAX_PACKAGE_MEMBERS)
    .check(noRepeatedEntries),
  tags: z.array(nonBlankText),
  sortOrder: columnInteger(0),
  serviceStatus: ServiceStatusTypeSchema,
  availability: ServiceAvailabilityTypeSchema,
  isActive: z.boolean(),
  options: z.array(serviceOptionSchema),
}) satisfies z.ZodType<ApiServiceCreateRequest>

export const serviceUpdateRequestSchema = serviceCreateRequestSchema
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiServiceUpdateRequest>

export const serviceSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: serviceIdSchema.exactOptional(),
  categoryId: categoryIdSchema.exactOptional(),
  isActive: z.boolean().exactOptional(),
}) satisfies z.ZodType<ApiServiceSearchRequest>

export const serviceBulkUpdateRequestSchema = z.strictObject({
  serviceIds: z.array(serviceIdSchema).min(1).max(100).check(noRepeatedEntries),
  updates: serviceUpdateRequestSchema,
}) satisfies z.ZodType<ApiServiceBulkUpdateRequest>
