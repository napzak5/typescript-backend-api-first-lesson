import {
  CustomerGenderTypeSchema,
  CustomerStatusTypeSchema,
  HairThicknessTypeSchema,
  HairTypeSchema,
  MembershipTierTypeSchema,
  ScalpConditionTypeSchema,
  ServiceCategoryTypeSchema,
} from '@beauty-salon-backend/generated'
import { parseISO } from 'date-fns'
import { z } from 'zod'
import {
  type ApiCustomerBasicPreferences,
  type ApiCustomerCreateRequest,
  type ApiCustomerProfileCreateRequest,
  type ApiCustomerProfileUpdateRequest,
  type ApiCustomerSearchRequest,
  type ApiCustomerUpdateRequest,
  customerIdSchema,
} from '../models/customer'
import {
  atLeastOneProperty,
  lowerCaseEmail,
  nonBlankText,
  noRepeatedEntries,
  phoneNumber,
} from './rules'

/**
 * Validation of customer requests. The shapes are checked against the
 * generated API types, the length limits are those of the database columns,
 * and the remaining rules are business rules. The rules that need the
 * current time, or another customer, are the use case's.
 */

/**
 * Shape of the `preferences` JSON column. Stored values are checked against
 * it when they are read, because the database only keeps them objects.
 */
export const storedCustomerPreferencesSchema = z.strictObject({
  preferredServices: z.array(ServiceCategoryTypeSchema),
  notes: z.string().nullable(),
}) satisfies z.ZodType<ApiCustomerBasicPreferences>

const customerPreferencesSchema = storedCustomerPreferencesSchema.extend({
  preferredServices: z
    .array(ServiceCategoryTypeSchema)
    .check(noRepeatedEntries),
  notes: nonBlankText.nullable(),
})

export const customerCreateRequestSchema = z.strictObject({
  firstName: nonBlankText.max(100),
  lastName: nonBlankText.max(100),
  firstNameKana: nonBlankText.max(100).nullable(),
  lastNameKana: nonBlankText.max(100).nullable(),
  email: lowerCaseEmail,
  phoneNumber,
  alternativePhone: phoneNumber.nullable(),
  postalCode: nonBlankText.max(10).nullable(),
  prefecture: nonBlankText.max(50).nullable(),
  city: nonBlankText.max(100).nullable(),
  address: nonBlankText.max(255).nullable(),
  building: nonBlankText.max(255).nullable(),
  birthDate: z.iso.date().nullable(),
  gender: CustomerGenderTypeSchema.nullable(),
  occupation: nonBlankText.max(100).nullable(),
  membershipTier: MembershipTierTypeSchema,
  preferences: customerPreferencesSchema.nullable(),
  notes: nonBlankText.nullable(),
  internalNotes: nonBlankText.nullable(),
  tags: z.array(nonBlankText).check(noRepeatedEntries),
  referredBy: customerIdSchema.nullable(),
  referralCode: nonBlankText.max(50).nullable(),
  allowMarketing: z.boolean(),
  allowSms: z.boolean(),
  allowEmail: z.boolean(),
  isActive: z.boolean(),
  hairType: HairTypeSchema.nullable(),
  hairThickness: HairThicknessTypeSchema.nullable(),
  scalpCondition: ScalpConditionTypeSchema.nullable(),
  customerStatus: CustomerStatusTypeSchema,
}) satisfies z.ZodType<ApiCustomerCreateRequest>

export const customerUpdateRequestSchema = customerCreateRequestSchema
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiCustomerUpdateRequest>

/**
 * What a customer writes about themselves: the properties of a ledger entry
 * that are theirs to state, under the rules of the ledger.
 */
export const customerProfileCreateRequestSchema =
  customerCreateRequestSchema.pick({
    firstName: true,
    lastName: true,
    firstNameKana: true,
    lastNameKana: true,
    phoneNumber: true,
    alternativePhone: true,
    postalCode: true,
    prefecture: true,
    city: true,
    address: true,
    building: true,
    birthDate: true,
    gender: true,
    occupation: true,
    preferences: true,
    allowMarketing: true,
    allowSms: true,
    allowEmail: true,
  }) satisfies z.ZodType<ApiCustomerProfileCreateRequest>

export const customerProfileUpdateRequestSchema =
  customerProfileCreateRequestSchema
    .exactPartial()
    .check(
      atLeastOneProperty,
    ) satisfies z.ZodType<ApiCustomerProfileUpdateRequest>

export const customerSearchRequestSchema = z
  .strictObject({
    limit: z.number().int().min(1).max(100).exactOptional(),
    cursor: customerIdSchema.exactOptional(),
    search: nonBlankText.max(100).exactOptional(),
    tags: z.array(nonBlankText).exactOptional(),
    registeredFrom: z.iso.datetime().exactOptional(),
    registeredTo: z.iso.datetime().exactOptional(),
    customerStatus: CustomerStatusTypeSchema.exactOptional(),
    membershipTier: MembershipTierTypeSchema.exactOptional(),
  })
  // The two are compared as times: as text, the same second with and
  // without a fraction would compare the wrong way round.
  .refine(
    ({ registeredFrom, registeredTo }) =>
      registeredFrom === undefined ||
      registeredTo === undefined ||
      parseISO(registeredFrom) <= parseISO(registeredTo),
    {
      path: ['registeredTo'],
      message: 'Must not be earlier than registeredFrom',
    },
  ) satisfies z.ZodType<ApiCustomerSearchRequest>
