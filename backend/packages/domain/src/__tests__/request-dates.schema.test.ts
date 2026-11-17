import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  availableSlotCheckRequestSchema,
  availableSlotSearchRequestSchema,
} from '../schemas/available-slot.schema'
import {
  bookingCompleteRequestSchema,
  bookingCreateRequestSchema,
  bookingRescheduleRequestSchema,
  bookingSearchRequestSchema,
  bookingServiceCreateRequestSchema,
  customerBookingCreateRequestSchema,
  customerBookingSearchRequestSchema,
} from '../schemas/booking.schema'
import {
  customerCreateRequestSchema,
  customerProfileCreateRequestSchema,
  customerProfileUpdateRequestSchema,
  customerSearchRequestSchema,
  customerUpdateRequestSchema,
} from '../schemas/customer.schema'
import {
  inventoryCreateRequestSchema,
  inventoryUpdateRequestSchema,
} from '../schemas/inventory.schema'
import {
  pointEarnRequestSchema,
  pointExpireRequestSchema,
  pointTransactionSearchRequestSchema,
} from '../schemas/point.schema'
import {
  saleCreateRequestSchema,
  saleSearchRequestSchema,
  saleUpdateRequestSchema,
} from '../schemas/sale.schema'
import {
  dailySalesGetRequestSchema,
  salesReportGetRequestSchema,
  salesTrendsGetRequestSchema,
} from '../schemas/sales-report.schema'
import {
  salonCreateRequestSchema,
  salonUpdateRequestSchema,
} from '../schemas/salon.schema'
import {
  staffCreateRequestSchema,
  staffUpdateRequestSchema,
} from '../schemas/staff.schema'
import {
  staffScheduleSearchRequestSchema,
  staffScheduleUpdateRequestSchema,
} from '../schemas/staff-schedule.schema'

/** The rules a value breaks, as `path:code`; empty when it breaks none. */
const brokenBy = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`) ?? []

/**
 * A date or a moment that a request schema reads: the schema, how a
 * request carries the value, and the path the value is reported under.
 * The request names nothing else, which the schema reports apart.
 */
type Field = [string, z.ZodType, (value: string) => unknown, string]

const DATE_FIELDS: Field[] = [
  [
    'availableSlotSearchRequestSchema',
    availableSlotSearchRequestSchema,
    (date) => ({ date }),
    'date',
  ],
  [
    'bookingSearchRequestSchema',
    bookingSearchRequestSchema,
    (bookingDateFrom) => ({ bookingDateFrom }),
    'bookingDateFrom',
  ],
  [
    'bookingSearchRequestSchema',
    bookingSearchRequestSchema,
    (bookingDateTo) => ({ bookingDateTo }),
    'bookingDateTo',
  ],
  [
    'customerBookingSearchRequestSchema',
    customerBookingSearchRequestSchema,
    (bookingDateFrom) => ({ bookingDateFrom }),
    'bookingDateFrom',
  ],
  [
    'customerBookingSearchRequestSchema',
    customerBookingSearchRequestSchema,
    (bookingDateTo) => ({ bookingDateTo }),
    'bookingDateTo',
  ],
  [
    'customerCreateRequestSchema',
    customerCreateRequestSchema,
    (birthDate) => ({ birthDate }),
    'birthDate',
  ],
  [
    'customerUpdateRequestSchema',
    customerUpdateRequestSchema,
    (birthDate) => ({ birthDate }),
    'birthDate',
  ],
  [
    'customerProfileCreateRequestSchema',
    customerProfileCreateRequestSchema,
    (birthDate) => ({ birthDate }),
    'birthDate',
  ],
  [
    'customerProfileUpdateRequestSchema',
    customerProfileUpdateRequestSchema,
    (birthDate) => ({ birthDate }),
    'birthDate',
  ],
  [
    'inventoryCreateRequestSchema',
    inventoryCreateRequestSchema,
    (expiryDate) => ({ expiryDate }),
    'expiryDate',
  ],
  [
    'inventoryUpdateRequestSchema',
    inventoryUpdateRequestSchema,
    (expiryDate) => ({ expiryDate }),
    'expiryDate',
  ],
  [
    'pointEarnRequestSchema',
    pointEarnRequestSchema,
    (expiryDate) => ({ expiryDate }),
    'expiryDate',
  ],
  [
    'pointExpireRequestSchema',
    pointExpireRequestSchema,
    (processBefore) => ({ processBefore }),
    'processBefore',
  ],
  [
    'saleSearchRequestSchema',
    saleSearchRequestSchema,
    (startDate) => ({ startDate }),
    'startDate',
  ],
  [
    'saleSearchRequestSchema',
    saleSearchRequestSchema,
    (endDate) => ({ endDate }),
    'endDate',
  ],
  [
    'salesReportGetRequestSchema',
    salesReportGetRequestSchema,
    (startDate) => ({ startDate }),
    'startDate',
  ],
  [
    'salesReportGetRequestSchema',
    salesReportGetRequestSchema,
    (endDate) => ({ endDate }),
    'endDate',
  ],
  [
    'salesTrendsGetRequestSchema',
    salesTrendsGetRequestSchema,
    (startDate) => ({ startDate }),
    'startDate',
  ],
  [
    'salesTrendsGetRequestSchema',
    salesTrendsGetRequestSchema,
    (endDate) => ({ endDate }),
    'endDate',
  ],
  [
    'dailySalesGetRequestSchema',
    dailySalesGetRequestSchema,
    (date) => ({ date }),
    'date',
  ],
  [
    'salonCreateRequestSchema',
    salonCreateRequestSchema,
    (date) => ({ openingHours: [{ date }] }),
    'openingHours.0.date',
  ],
  [
    'salonUpdateRequestSchema',
    salonUpdateRequestSchema,
    (date) => ({ openingHours: [{ date }] }),
    'openingHours.0.date',
  ],
  [
    'staffScheduleUpdateRequestSchema',
    staffScheduleUpdateRequestSchema,
    (date) => [{ date }],
    '0.date',
  ],
  [
    'staffScheduleSearchRequestSchema',
    staffScheduleSearchRequestSchema,
    (date) => ({ date }),
    'date',
  ],
  [
    'staffCreateRequestSchema',
    staffCreateRequestSchema,
    (hireDate) => ({ hireDate }),
    'hireDate',
  ],
  [
    'staffUpdateRequestSchema',
    staffUpdateRequestSchema,
    (hireDate) => ({ hireDate }),
    'hireDate',
  ],
]

const MOMENT_FIELDS: Field[] = [
  [
    'availableSlotCheckRequestSchema',
    availableSlotCheckRequestSchema,
    (startTime) => ({ startTime }),
    'startTime',
  ],
  [
    'bookingCreateRequestSchema',
    bookingCreateRequestSchema,
    (startTime) => ({ services: [{ startTime }] }),
    'services.0.startTime',
  ],
  [
    'bookingServiceCreateRequestSchema',
    bookingServiceCreateRequestSchema,
    (startTime) => ({ startTime }),
    'startTime',
  ],
  [
    'bookingRescheduleRequestSchema',
    bookingRescheduleRequestSchema,
    (startTime) => ({ startTime }),
    'startTime',
  ],
  [
    'bookingCompleteRequestSchema',
    bookingCompleteRequestSchema,
    (actualStartTime) => ({ actualStartTime }),
    'actualStartTime',
  ],
  [
    'bookingCompleteRequestSchema',
    bookingCompleteRequestSchema,
    (actualEndTime) => ({ actualEndTime }),
    'actualEndTime',
  ],
  [
    'customerBookingCreateRequestSchema',
    customerBookingCreateRequestSchema,
    (startTime) => ({ startTime }),
    'startTime',
  ],
  [
    'customerSearchRequestSchema',
    customerSearchRequestSchema,
    (registeredFrom) => ({ registeredFrom }),
    'registeredFrom',
  ],
  [
    'customerSearchRequestSchema',
    customerSearchRequestSchema,
    (registeredTo) => ({ registeredTo }),
    'registeredTo',
  ],
  [
    'pointTransactionSearchRequestSchema',
    pointTransactionSearchRequestSchema,
    (startDate) => ({ startDate }),
    'startDate',
  ],
  [
    'pointTransactionSearchRequestSchema',
    pointTransactionSearchRequestSchema,
    (endDate) => ({ endDate }),
    'endDate',
  ],
  [
    'saleCreateRequestSchema',
    saleCreateRequestSchema,
    (saleTime) => ({ saleTime }),
    'saleTime',
  ],
  [
    'saleUpdateRequestSchema',
    saleUpdateRequestSchema,
    (saleTime) => ({ saleTime }),
    'saleTime',
  ],
]

/** The rules that the value under a path breaks. */
const brokenAt = ([, schema, request, path]: Field, value: string): string[] =>
  brokenBy(schema, request(value)).filter((rule) => rule.startsWith(`${path}:`))

/** Each case of a field: its name, the value and what it breaks. */
const cases = (
  fields: Field[],
  values: [string, string[]][],
): [string, string, string, string[], Field][] =>
  fields.flatMap((field) =>
    values.map(([value, rules]): [string, string, string, string[], Field] => [
      field[0],
      field[3],
      value,
      rules.map((rule) => `${field[3]}:${rule}`),
      field,
    ]),
  )

describe('the dates of a request', () => {
  it.each(
    cases(DATE_FIELDS, [
      ['1900-01-01', []],
      ['2999-12-31', []],
      ['0000-01-01', ['too_small']],
      ['1899-12-31', ['too_small']],
      ['3000-01-01', ['too_big']],
    ]),
  )('%s reads %s of %s as %j', (_schema, _path, value, expected, field) => {
    expect(brokenAt(field, value)).toEqual(expected)
  })
})

describe('the moments of a request', () => {
  it.each(
    cases(MOMENT_FIELDS, [
      ['1900-01-01T00:00:00Z', []],
      ['2999-12-31T23:59:00Z', []],
      ['0000-01-01T00:00:00Z', ['too_small']],
      ['1899-12-31T23:59:00Z', ['too_small']],
      ['3000-01-01T00:00:00Z', ['too_big']],
    ]),
  )('%s reads %s of %s as %j', (_schema, _path, value, expected, field) => {
    expect(brokenAt(field, value)).toEqual(expected)
  })
})
