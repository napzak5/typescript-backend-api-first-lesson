import { ServiceCategoryTypeSchema } from '@beauty-salon-backend/generated'
import { asOneString } from '@beauty-salon-shared/i18n'
import { serviceCategoryMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import {
  type ApiServiceCategoryCreateRequest,
  type ApiServiceCategorySearchRequest,
  type ApiServiceCategoryUpdateRequest,
  categoryIdSchema,
} from '../models/service-category'
import { atLeastOneProperty, MAX_INTEGER, nonBlankText } from './rules'

/**
 * Validation of service category requests. The shapes are checked against
 * the generated API types, the limits are those of the database columns, and
 * the remaining rules are business rules. Whether `parentId` names a
 * category that may be the parent is decided where the categories are
 * stored, together with the write.
 */

export const serviceCategoryCreateRequestSchema = z.strictObject({
  name: nonBlankText.max(100),
  description: nonBlankText.nullable(),
  parentId: categoryIdSchema.nullable(),
  category: ServiceCategoryTypeSchema,
  displayOrder: z.number().int().min(0).max(MAX_INTEGER),
  iconUrl: z.httpUrl().max(500).nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, asOneString(serviceCategoryMessages.colour))
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

/** A search that was checked: its cursor is the ID of a category. */
export type ServiceCategorySearchRequest = z.infer<
  typeof serviceCategorySearchRequestSchema
>
