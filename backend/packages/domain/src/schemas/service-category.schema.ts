import { ServiceCategoryTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import {
  type ApiServiceCategoryCreateRequest,
  type ApiServiceCategorySearchRequest,
  type ApiServiceCategoryUpdateRequest,
  categoryIdSchema,
} from '../models/service-category'
import { atLeastOneProperty, nonBlankText } from './rules'

/**
 * Validation of service category requests. The shapes are checked against
 * the generated API types, the limits are those of the database columns, and
 * the remaining rules are business rules. Whether `parentId` names a
 * category that may be the parent is decided where the categories are
 * stored, together with the write.
 */

/** The largest value of an `integer` column. */
const MAX_INTEGER = 2_147_483_647

export const serviceCategoryCreateRequestSchema = z.strictObject({
  name: nonBlankText.max(100),
  description: nonBlankText.nullable(),
  parentId: categoryIdSchema.nullable(),
  category: ServiceCategoryTypeSchema,
  displayOrder: z.number().int().min(0).max(MAX_INTEGER),
  iconUrl: z.httpUrl().max(500).nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a colour in #RRGGBB format')
    .nullable(),
  isActive: z.boolean(),
}) satisfies z.ZodType<ApiServiceCategoryCreateRequest>

export const serviceCategoryUpdateRequestSchema =
  serviceCategoryCreateRequestSchema
    .exactPartial()
    .check(
      atLeastOneProperty,
    ) satisfies z.ZodType<ApiServiceCategoryUpdateRequest>

export const serviceCategorySearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: categoryIdSchema.exactOptional(),
  isActive: z.boolean().exactOptional(),
}) satisfies z.ZodType<ApiServiceCategorySearchRequest>
