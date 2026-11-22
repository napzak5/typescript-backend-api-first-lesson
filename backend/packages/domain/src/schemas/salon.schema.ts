import { DayOfWeekTypeSchema } from '@beauty-salon-backend/generated'
import { asOneString } from '@beauty-salon-shared/i18n'
import {
  ruleMessages,
  salonMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { parseISO } from 'date-fns'
import { z } from 'zod'
import {
  type ApiBusinessHours,
  type ApiSalonCreateRequest,
  type ApiSalonSearchRequest,
  type ApiSalonUpdateRequest,
  salonIdSchema,
} from '../models/salon'
import {
  atLeastOneProperty,
  calendarDate,
  dayOfWeekOf,
  nonBlankText,
  orderedTimeSlot,
  phoneNumber,
  timeOfDay,
  timeSlot,
  timeZoneName,
  withSeconds,
} from './rules'

/**
 * Validation of salon requests. The shapes are checked against the generated
 * API types, the length limits are those of the database columns, and the
 * remaining rules are business rules.
 */

const openingHoursSchema = z
  .strictObject({
    dayOfWeek: DayOfWeekTypeSchema,
    date: calendarDate,
    openTime: timeOfDay.nullable(),
    closeTime: timeOfDay.nullable(),
    isHoliday: z.boolean(),
    holidayName: nonBlankText.max(100).nullable(),
    notes: nonBlankText.nullable(),
  })
  .check((context) => {
    const { dayOfWeek, date, openTime, closeTime, isHoliday } = context.value

    const dayOfDate = dayOfWeekOf(date)
    if (dayOfDate !== null && dayOfDate !== dayOfWeek) {
      context.issues.push({
        code: 'custom',
        path: ['dayOfWeek'],
        message: asOneString(salonMessages.dayOfWeekOf(date)),
        input: dayOfWeek,
      })
    }

    // Only a holiday may leave both times out.
    const needsTimes = !isHoliday || openTime !== null || closeTime !== null
    if (needsTimes && openTime === null) {
      context.issues.push({
        code: 'custom',
        path: ['openTime'],
        message: asOneString(salonMessages.timesUnlessHoliday),
        input: openTime,
      })
    }
    if (needsTimes && closeTime === null) {
      context.issues.push({
        code: 'custom',
        path: ['closeTime'],
        message: asOneString(salonMessages.timesUnlessHoliday),
        input: closeTime,
      })
    }

    if (
      openTime !== null &&
      closeTime !== null &&
      withSeconds(openTime) >= withSeconds(closeTime)
    ) {
      context.issues.push({
        code: 'custom',
        path: ['closeTime'],
        message: asOneString(ruleMessages.laterThan('openTime')),
        input: closeTime,
      })
    }
  })

/** The calendar holds one entry per date. */
const openingHoursListSchema = z.array(openingHoursSchema).check((context) => {
  const seen = new Set<string>()
  context.value.forEach((entry, index) => {
    if (seen.has(entry.date)) {
      context.issues.push({
        code: 'custom',
        path: [index, 'date'],
        message: asOneString(salonMessages.noRepeatedDate),
        input: entry.date,
      })
    }
    seen.add(entry.date)
  })
})

const dateRangeSchema = z.strictObject({
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
})

/**
 * Shape of the `businessHours` JSON column. Stored values are checked against
 * it when they are read, because the database cannot enforce it.
 */
export const storedBusinessHoursSchema = z.strictObject({
  dayOfWeek: DayOfWeekTypeSchema,
  operatingSlots: z.array(timeSlot),
  breakSlots: z.array(timeSlot).nullable(),
  isClosed: z.boolean(),
  effectivePeriod: dateRangeSchema.nullable(),
}) satisfies z.ZodType<ApiBusinessHours>

const businessHoursSchema = storedBusinessHoursSchema
  .extend({
    operatingSlots: z.array(orderedTimeSlot),
    breakSlots: z.array(orderedTimeSlot).nullable(),
    // Compared as times: as text, `…:00Z` sorts after `…:00.500Z`.
    effectivePeriod: dateRangeSchema
      .refine(
        (period) => parseISO(period.startDate) <= parseISO(period.endDate),
        {
          path: ['endDate'],
          message: asOneString(ruleMessages.notEarlierThan('startDate')),
        },
      )
      .nullable(),
  })
  .refine((hours) => !hours.isClosed || hours.operatingSlots.length === 0, {
    path: ['operatingSlots'],
    message: asOneString(salonMessages.emptyWhenClosed),
  })

/** The regular week holds one entry per day of the week. */
const businessHoursListSchema = z
  .array(businessHoursSchema)
  .check((context) => {
    const seen = new Set<string>()
    context.value.forEach((entry, index) => {
      if (seen.has(entry.dayOfWeek)) {
        context.issues.push({
          code: 'custom',
          path: [index, 'dayOfWeek'],
          message: asOneString(salonMessages.noRepeatedDay),
          input: entry.dayOfWeek,
        })
      }
      seen.add(entry.dayOfWeek)
    })
  })

export const salonCreateRequestSchema = z.strictObject({
  name: nonBlankText.max(255),
  nameKana: nonBlankText.max(255).nullable(),
  description: nonBlankText.nullable(),
  postalCode: nonBlankText.max(10).nullable(),
  prefecture: nonBlankText.max(50),
  city: nonBlankText.max(100),
  address: nonBlankText.max(255),
  building: nonBlankText.max(255).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  phoneNumber,
  alternativePhone: phoneNumber.nullable(),
  email: z.email().max(255),
  websiteUrl: z.httpUrl().max(500).nullable(),
  logoUrl: z.httpUrl().max(500).nullable(),
  imageUrls: z.array(z.httpUrl()),
  features: z.array(nonBlankText),
  amenities: z.array(nonBlankText),
  businessHours: businessHoursListSchema.nullable(),
  timezone: timeZoneName,
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, asOneString(salonMessages.currencyCode)),
  // The column keeps two decimal places.
  taxRate: z.number().min(0).max(100).multipleOf(0.01),
  isActive: z.boolean(),
  openingHours: openingHoursListSchema,
}) satisfies z.ZodType<ApiSalonCreateRequest>

export const salonUpdateRequestSchema = salonCreateRequestSchema
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiSalonUpdateRequest>

export const salonSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: salonIdSchema.exactOptional(),
  keyword: nonBlankText.max(100).exactOptional(),
  prefecture: nonBlankText.max(50).exactOptional(),
  city: nonBlankText.max(100).exactOptional(),
  isActive: z.boolean().exactOptional(),
  minRating: z.number().min(0).max(5).exactOptional(),
  features: z.array(nonBlankText).exactOptional(),
}) satisfies z.ZodType<ApiSalonSearchRequest>

/** A search that was checked: its cursor is the ID of a salon. */
export type SalonSearchRequest = z.infer<typeof salonSearchRequestSchema>
