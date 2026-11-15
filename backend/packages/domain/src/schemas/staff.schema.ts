import { StaffLevelTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import {
  type ApiStaffCreateRequest,
  type ApiStaffSearchRequest,
  type ApiStaffUpdateRequest,
  staffIdSchema,
} from '../models/staff'
import {
  atLeastOneProperty,
  lowerCaseEmail,
  MAX_INTEGER,
  nonBlankText,
  noRepeatedEntries,
  phoneNumber,
} from './rules'

/**
 * Validation of staff requests. The shapes are checked against the
 * generated API types, the length limits are those of the database columns,
 * and the remaining rules are business rules. The rule that needs the
 * actor (nobody deactivates their own record) is the use case's.
 */

export const staffCreateRequestSchema = z.strictObject({
  firstName: nonBlankText.max(100),
  lastName: nonBlankText.max(100),
  firstNameKana: nonBlankText.max(100).nullable(),
  lastNameKana: nonBlankText.max(100).nullable(),
  displayName: nonBlankText.max(255),
  email: lowerCaseEmail,
  phoneNumber,
  alternativePhone: phoneNumber.nullable(),
  staffCode: nonBlankText.max(50).nullable(),
  level: StaffLevelTypeSchema,
  position: nonBlankText.max(100).nullable(),
  specialties: z.array(nonBlankText).check(noRepeatedEntries),
  bio: nonBlankText.nullable(),
  imageUrl: z.httpUrl().max(500).nullable(),
  yearsOfExperience: z.number().int().min(0).max(100).nullable(),
  certifications: z.array(nonBlankText).check(noRepeatedEntries),
  hireDate: z.iso.date().nullable(),
  employmentType: nonBlankText.max(50).nullable(),
  baseSalary: z.number().int().min(0).max(MAX_INTEGER).nullable(),
  // The column keeps two decimal places.
  commissionRate: z.number().min(0).max(100).multipleOf(0.01).nullable(),
  canReceiveBookings: z.boolean(),
  maxConcurrentBookings: z.number().int().min(1).max(10),
  bufferTimeBefore: z.number().int().min(0).max(120),
  bufferTimeAfter: z.number().int().min(0).max(120),
  isActive: z.boolean(),
}) satisfies z.ZodType<ApiStaffCreateRequest>

export const staffUpdateRequestSchema = staffCreateRequestSchema
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiStaffUpdateRequest>

export const staffSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: staffIdSchema.exactOptional(),
}) satisfies z.ZodType<ApiStaffSearchRequest>
