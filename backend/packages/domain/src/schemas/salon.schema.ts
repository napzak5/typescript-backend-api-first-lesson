import { DayOfWeekTypeSchema } from '@beauty-salon-backend/generated'
import { format, isValid, parseISO } from 'date-fns'
import { z } from 'zod'
import {
  type ApiBusinessHours,
  type ApiSalonCreateRequest,
  type ApiSalonSearchRequest,
  type ApiSalonUpdateRequest,
  salonIdSchema,
} from '../models/salon'

/**
 * Validation of salon requests. The shapes are checked against the generated
 * API types, the length limits are those of the database columns, and the
 * remaining rules are business rules.
 */

const MIN_PHONE_DIGITS = 10

/** A nullable text is either null or says something: '' is not "unset". */
const nonBlankText = z.string().regex(/\S/, 'Must not be blank')

const phoneNumberSchema = z
  .string()
  .max(20)
  .regex(/^[\d\s\-+()]+$/, 'Must be a phone number')
  .refine(
    (value) => value.replace(/\D/g, '').length >= MIN_PHONE_DIGITS,
    `Must contain at least ${MIN_PHONE_DIGITS} digits`,
  )

/** Time of a `time` column; the database returns it as HH:mm:ss. */
const timeOfDaySchema = z
  .string()
  .regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/,
    'Must be a time in HH:mm or HH:mm:ss format',
  )

const withSeconds = (time: string): string => time.padEnd(8, ':00')

/** Null when the text is not a date; the format rule reports that. */
const dayOfWeekOf = (date: string): string | null => {
  const parsed = parseISO(date)
  return isValid(parsed) ? format(parsed, 'EEEE').toLowerCase() : null
}

const openingHoursSchema = z
  .strictObject({
    dayOfWeek: DayOfWeekTypeSchema,
    date: z.iso.date(),
    openTime: timeOfDaySchema.nullable(),
    closeTime: timeOfDaySchema.nullable(),
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
        message: `Must be the day of the week of ${date}`,
        input: dayOfWeek,
      })
    }

    // Only a holiday may leave both times out.
    const needsTimes = !isHoliday || openTime !== null || closeTime !== null
    if (needsTimes && openTime === null) {
      context.issues.push({
        code: 'custom',
        path: ['openTime'],
        message: 'Required unless the day is a holiday without opening hours',
        input: openTime,
      })
    }
    if (needsTimes && closeTime === null) {
      context.issues.push({
        code: 'custom',
        path: ['closeTime'],
        message: 'Required unless the day is a holiday without opening hours',
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
        message: 'Must be later than openTime',
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
        message: 'Must not repeat a date of an earlier entry',
        input: entry.date,
      })
    }
    seen.add(entry.date)
  })
})

const timeSlotSchema = z.strictObject({
  startTime: z.iso.time({ precision: -1 }),
  endTime: z.iso.time({ precision: -1 }),
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
  operatingSlots: z.array(timeSlotSchema),
  breakSlots: z.array(timeSlotSchema).nullable(),
  isClosed: z.boolean(),
  effectivePeriod: dateRangeSchema.nullable(),
  timezone: nonBlankText.nullable(),
}) satisfies z.ZodType<ApiBusinessHours>

const orderedTimeSlotSchema = timeSlotSchema.refine(
  (slot) => slot.startTime < slot.endTime,
  { path: ['endTime'], message: 'Must be later than startTime' },
)

const businessHoursSchema = storedBusinessHoursSchema
  .extend({
    operatingSlots: z.array(orderedTimeSlotSchema),
    breakSlots: z.array(orderedTimeSlotSchema).nullable(),
    effectivePeriod: dateRangeSchema
      .refine((period) => period.startDate <= period.endDate, {
        path: ['endDate'],
        message: 'Must not be earlier than startDate',
      })
      .nullable(),
  })
  .refine((hours) => !hours.isClosed || hours.operatingSlots.length === 0, {
    path: ['operatingSlots'],
    message: 'Must be empty when the day is closed',
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
          message: 'Must not repeat the day of an earlier entry',
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
  phoneNumber: phoneNumberSchema,
  alternativePhone: phoneNumberSchema.nullable(),
  email: z.email().max(255),
  websiteUrl: z.httpUrl().max(500).nullable(),
  logoUrl: z.httpUrl().max(500).nullable(),
  imageUrls: z.array(z.httpUrl()),
  features: z.array(nonBlankText),
  amenities: z.array(nonBlankText),
  businessHours: businessHoursListSchema.nullable(),
  timezone: nonBlankText.max(50),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'Must be a three-letter ISO 4217 currency code'),
  // The column keeps two decimal places.
  taxRate: z.number().min(0).max(100).multipleOf(0.01),
  isActive: z.boolean(),
  openingHours: openingHoursListSchema,
}) satisfies z.ZodType<ApiSalonCreateRequest>

export const salonUpdateRequestSchema = salonCreateRequestSchema
  .exactPartial()
  .check((context) => {
    // An unknown property is reported as such, not as an empty request.
    if (
      context.issues.length === 0 &&
      Object.keys(context.value).length === 0
    ) {
      context.issues.push({
        code: 'custom',
        path: [],
        message: 'At least one property must be specified',
        input: context.value,
      })
    }
  }) satisfies z.ZodType<ApiSalonUpdateRequest>

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
