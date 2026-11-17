import type { Express } from 'express'
import type { Response } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertCustomer,
  insertSalon,
  insertStaff,
  signedInUser,
  signInAsAdmin,
} from './_shared/auth-helpers'
import { createTestApp, getTestDb, request } from './_shared/test-helpers'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/**
 * Days outside the range a request may name, and what each breaks: the
 * year 0, which PostgreSQL does not hold, the day before 1900 and the
 * first day after 2999.
 */
const DATES: [string, string][] = [
  ['0000-01-01', 'too_small'],
  ['1899-12-31', 'too_small'],
  ['3000-01-01', 'too_big'],
]

/** The same as moments in UTC, each on a whole minute. */
const MOMENTS: [string, string][] = [
  ['0000-01-01T00:00:00Z', 'too_small'],
  ['1899-12-31T23:59:00Z', 'too_small'],
  ['3000-01-01T00:00:00Z', 'too_big'],
]

type Method = 'get' | 'post' | 'patch' | 'put'
type Signer = 'admin' | 'customer' | 'newCustomer'

/**
 * An operation that reads a date or a moment from a request: how it is
 * called with a value, who calls it, and under which field the value is
 * reported. A query is sent as it is written; a body is sent as JSON.
 */
type Operation = {
  name: string
  method: Method
  path: (ids: Ids) => string
  send: (value: string, ids: Ids) => object | string
  as: Signer
  field: string
}

type Ids = { salonId: string; customerId: string; staffId: string }

const query = (parameters: Record<string, string>): string =>
  new URLSearchParams(parameters).toString()

const period = (startDate: string): Record<string, string> => ({
  startDate,
  endDate: '2026-01-31',
})

const DATE_OPERATIONS: Operation[] = [
  {
    name: 'the available slots',
    method: 'get',
    path: ({ salonId }) => `/api/v1/salons/${salonId}/available-slots`,
    send: (date) => query({ serviceId: UNKNOWN_ID, date }),
    as: 'customer',
    field: 'date',
  },
  {
    name: 'the booking ledger, from a day',
    method: 'get',
    path: () => '/api/v1/bookings',
    send: (bookingDateFrom) => query({ bookingDateFrom }),
    as: 'admin',
    field: 'bookingDateFrom',
  },
  {
    name: 'the booking ledger, to a day',
    method: 'get',
    path: () => '/api/v1/bookings',
    send: (bookingDateTo) => query({ bookingDateTo }),
    as: 'admin',
    field: 'bookingDateTo',
  },
  {
    name: "a customer's own bookings, from a day",
    method: 'get',
    path: () => '/api/v1/customers/me/bookings',
    send: (bookingDateFrom) => query({ bookingDateFrom }),
    as: 'customer',
    field: 'bookingDateFrom',
  },
  {
    name: "a customer's own bookings, to a day",
    method: 'get',
    path: () => '/api/v1/customers/me/bookings',
    send: (bookingDateTo) => query({ bookingDateTo }),
    as: 'customer',
    field: 'bookingDateTo',
  },
  {
    name: 'a new customer of the ledger',
    method: 'post',
    path: () => '/api/v1/customers',
    send: (birthDate) => ({ birthDate }),
    as: 'admin',
    field: 'birthDate',
  },
  {
    name: 'a change of a customer of the ledger',
    method: 'patch',
    path: ({ customerId }) => `/api/v1/customers/${customerId}`,
    send: (birthDate) => ({ birthDate }),
    as: 'admin',
    field: 'birthDate',
  },
  {
    name: "a customer's own new profile",
    method: 'post',
    path: () => '/api/v1/customers/me',
    send: (birthDate) => ({ birthDate }),
    as: 'newCustomer',
    field: 'birthDate',
  },
  {
    name: "a change of a customer's own profile",
    method: 'patch',
    path: () => '/api/v1/customers/me',
    send: (birthDate) => ({ birthDate }),
    as: 'customer',
    field: 'birthDate',
  },
  {
    name: 'an earning of points',
    method: 'post',
    path: () => '/api/v1/points/earn',
    send: (expiryDate) => ({ expiryDate }),
    as: 'admin',
    field: 'expiryDate',
  },
  {
    name: 'the expiry of points',
    method: 'post',
    path: () => '/api/v1/points/expire',
    send: (processBefore) => ({ customerId: null, processBefore }),
    as: 'admin',
    field: 'processBefore',
  },
  {
    name: 'the sales ledger, from a day',
    method: 'get',
    path: () => '/api/v1/sales',
    send: (startDate) => query({ startDate }),
    as: 'admin',
    field: 'startDate',
  },
  {
    name: 'the sales ledger, to a day',
    method: 'get',
    path: () => '/api/v1/sales',
    send: (endDate) => query({ endDate }),
    as: 'admin',
    field: 'endDate',
  },
  ...['', '/by-staff', '/by-category', '/trends', '/export'].flatMap(
    (report): Operation[] => [
      {
        name: `the sales report${report}, from a day`,
        method: 'get',
        path: () => `/api/v1/sales-reports${report}`,
        send: (startDate, { salonId }) =>
          query({ salonId, ...period(startDate) }),
        as: 'admin',
        field: 'startDate',
      },
      {
        name: `the sales report${report}, to a day`,
        method: 'get',
        path: () => `/api/v1/sales-reports${report}`,
        send: (endDate, { salonId }) =>
          query({ salonId, startDate: '2026-01-01', endDate }),
        as: 'admin',
        field: 'endDate',
      },
    ],
  ),
  {
    name: 'the sales of a day',
    method: 'get',
    path: () => '/api/v1/sales-reports/daily',
    send: (date, { salonId }) => query({ salonId, date }),
    as: 'admin',
    field: 'date',
  },
  {
    name: 'a new salon with the hours of a day',
    method: 'post',
    path: () => '/api/v1/salons',
    send: (date) => ({ openingHours: [{ date }] }),
    as: 'admin',
    field: 'openingHours.0.date',
  },
  {
    name: 'a change of the hours of a day of a salon',
    method: 'patch',
    path: ({ salonId }) => `/api/v1/salons/${salonId}`,
    send: (date) => ({ openingHours: [{ date }] }),
    as: 'admin',
    field: 'openingHours.0.date',
  },
  {
    name: 'the schedule of a staff member on a day',
    method: 'get',
    path: ({ salonId, staffId }) =>
      `/api/v1/salons/${salonId}/staff/${staffId}/schedules`,
    send: (date) => query({ date }),
    as: 'admin',
    field: 'date',
  },
  {
    name: 'a schedule of a staff member with an entry for a day',
    method: 'put',
    path: ({ salonId, staffId }) =>
      `/api/v1/salons/${salonId}/staff/${staffId}/schedules`,
    send: (date) => [{ date }],
    as: 'admin',
    field: '0.date',
  },
  {
    name: 'a new staff member',
    method: 'post',
    path: ({ salonId }) => `/api/v1/salons/${salonId}/staff`,
    send: (hireDate) => ({ hireDate }),
    as: 'admin',
    field: 'hireDate',
  },
  {
    name: 'a change of a staff member',
    method: 'patch',
    path: ({ salonId, staffId }) =>
      `/api/v1/salons/${salonId}/staff/${staffId}`,
    send: (hireDate) => ({ hireDate }),
    as: 'admin',
    field: 'hireDate',
  },
  {
    name: 'a new stock row',
    method: 'post',
    path: () => '/api/v1/inventory',
    send: (expiryDate) => ({ expiryDate }),
    as: 'admin',
    field: 'expiryDate',
  },
  {
    name: 'a change of a stock row',
    method: 'patch',
    path: () => `/api/v1/inventory/${UNKNOWN_ID}`,
    send: (expiryDate) => ({ expiryDate }),
    as: 'admin',
    field: 'expiryDate',
  },
  {
    name: 'a new treatment record',
    method: 'post',
    path: () => '/api/v1/treatments',
    send: (nextRecommendedDate) => ({ nextRecommendedDate }),
    as: 'admin',
    field: 'nextRecommendedDate',
  },
  {
    name: 'a change of a treatment record',
    method: 'patch',
    path: () => `/api/v1/treatments/${UNKNOWN_ID}`,
    send: (nextRecommendedDate) => ({ nextRecommendedDate }),
    as: 'admin',
    field: 'nextRecommendedDate',
  },
]

const MOMENT_OPERATIONS: Operation[] = [
  {
    name: 'a check of an available slot',
    method: 'post',
    path: ({ salonId }) => `/api/v1/salons/${salonId}/available-slots/check`,
    send: (startTime) => ({ startTime }),
    as: 'admin',
    field: 'startTime',
  },
  {
    name: 'a new booking',
    method: 'post',
    path: () => '/api/v1/bookings',
    send: (startTime) => ({ services: [{ startTime }] }),
    as: 'admin',
    field: 'services.0.startTime',
  },
  {
    name: 'a booking moved',
    method: 'post',
    path: () => `/api/v1/bookings/${UNKNOWN_ID}/reschedule`,
    send: (startTime) => ({ startTime }),
    as: 'admin',
    field: 'startTime',
  },
  {
    name: 'a booking completed, from the time it began',
    method: 'post',
    path: () => `/api/v1/bookings/${UNKNOWN_ID}/complete`,
    send: (actualStartTime) => ({ actualStartTime }),
    as: 'admin',
    field: 'actualStartTime',
  },
  {
    name: 'a booking completed, to the time it ended',
    method: 'post',
    path: () => `/api/v1/bookings/${UNKNOWN_ID}/complete`,
    send: (actualEndTime) => ({ actualEndTime }),
    as: 'admin',
    field: 'actualEndTime',
  },
  {
    name: 'a service line added to a booking',
    method: 'post',
    path: () => `/api/v1/bookings/${UNKNOWN_ID}/services`,
    send: (startTime) => ({ startTime }),
    as: 'admin',
    field: 'startTime',
  },
  {
    name: "a customer's own new booking",
    method: 'post',
    path: () => '/api/v1/customers/me/bookings',
    send: (startTime) => ({ startTime }),
    as: 'customer',
    field: 'startTime',
  },
  {
    name: "a customer's own booking moved",
    method: 'post',
    path: () => `/api/v1/customers/me/bookings/${UNKNOWN_ID}/reschedule`,
    send: (startTime) => ({ startTime }),
    as: 'customer',
    field: 'startTime',
  },
  {
    name: 'the customer ledger, registered from a moment',
    method: 'get',
    path: () => '/api/v1/customers',
    send: (registeredFrom) => query({ registeredFrom }),
    as: 'admin',
    field: 'registeredFrom',
  },
  {
    name: 'the customer ledger, registered to a moment',
    method: 'get',
    path: () => '/api/v1/customers',
    send: (registeredTo) => query({ registeredTo }),
    as: 'admin',
    field: 'registeredTo',
  },
  {
    name: 'the history of a stock row, from a moment',
    method: 'get',
    path: () => `/api/v1/inventory/${UNKNOWN_ID}/movements`,
    send: (startDate) => query({ startDate }),
    as: 'admin',
    field: 'startDate',
  },
  {
    name: 'the history of a stock row, to a moment',
    method: 'get',
    path: () => `/api/v1/inventory/${UNKNOWN_ID}/movements`,
    send: (endDate) => query({ endDate }),
    as: 'admin',
    field: 'endDate',
  },
  {
    name: 'the point history of a customer, from a moment',
    method: 'get',
    path: ({ customerId }) =>
      `/api/v1/points/customer/${customerId}/transactions`,
    send: (startDate) => query({ startDate }),
    as: 'admin',
    field: 'startDate',
  },
  {
    name: 'the point history of a customer, to a moment',
    method: 'get',
    path: ({ customerId }) =>
      `/api/v1/points/customer/${customerId}/transactions`,
    send: (endDate) => query({ endDate }),
    as: 'admin',
    field: 'endDate',
  },
  {
    name: 'a new sale',
    method: 'post',
    path: () => '/api/v1/sales',
    send: (saleTime) => ({ saleTime }),
    as: 'admin',
    field: 'saleTime',
  },
  {
    name: 'a change of a sale',
    method: 'patch',
    path: () => `/api/v1/sales/${UNKNOWN_ID}`,
    send: (saleTime) => ({ saleTime }),
    as: 'admin',
    field: 'saleTime',
  },
  {
    name: 'a new purchase order',
    method: 'post',
    path: () => '/api/v1/purchase-orders',
    send: (expectedDelivery) => ({ expectedDelivery }),
    as: 'admin',
    field: 'expectedDelivery',
  },
  {
    name: 'a change of a purchase order',
    method: 'patch',
    path: () => `/api/v1/purchase-orders/${UNKNOWN_ID}`,
    send: (expectedDelivery) => ({ expectedDelivery }),
    as: 'admin',
    field: 'expectedDelivery',
  },
  {
    name: 'the purchase orders, from a moment',
    method: 'get',
    path: () => '/api/v1/purchase-orders',
    send: (startDate) => query({ startDate }),
    as: 'admin',
    field: 'startDate',
  },
  {
    name: 'the purchase orders, to a moment',
    method: 'get',
    path: () => '/api/v1/purchase-orders',
    send: (endDate) => query({ endDate }),
    as: 'admin',
    field: 'endDate',
  },
  {
    name: 'the treatment records, from a moment',
    method: 'get',
    path: () => '/api/v1/treatments',
    send: (startDate) => query({ startDate }),
    as: 'admin',
    field: 'startDate',
  },
  {
    name: 'the treatment records, to a moment',
    method: 'get',
    path: () => '/api/v1/treatments',
    send: (endDate) => query({ endDate }),
    as: 'admin',
    field: 'endDate',
  },
  {
    name: 'the treatment statistics, from a moment',
    method: 'get',
    path: () => '/api/v1/treatments/statistics',
    send: (startDate, { salonId }) => query({ salonId, startDate }),
    as: 'admin',
    field: 'startDate',
  },
  {
    name: 'the treatment statistics, to a moment',
    method: 'get',
    path: () => '/api/v1/treatments/statistics',
    send: (endDate, { salonId }) => query({ salonId, endDate }),
    as: 'admin',
    field: 'endDate',
  },
]

describe('the dates and moments a request may name', () => {
  let app: Express
  let ids: Ids
  let authorizations: Record<Signer, string>

  beforeEach(async () => {
    app = createTestApp()
    const db = getTestDb()
    const salonId = await insertSalon(db)
    const customerId = await insertCustomer(db)
    ids = {
      salonId,
      customerId,
      staffId: await insertStaff(db, salonId),
    }
    authorizations = {
      admin: await signInAsAdmin(app, db),
      customer: (await signedInUser(app, db, { customerId })).authorization,
      newCustomer: (await signedInUser(app, db)).authorization,
    }
  })

  const send = (operation: Operation, value: string): Promise<Response> => {
    const path = operation.path(ids)
    const content = operation.send(value, ids)
    const call =
      operation.method === 'get'
        ? request(app).get(`${path}?${content}`)
        : request(app)[operation.method](path).send(content)
    return call.set('Authorization', authorizations[operation.as])
  }

  const cases = (
    operations: Operation[],
    values: [string, string][],
  ): [string, string, string, Operation][] =>
    operations.flatMap((operation) =>
      values.map(([value, rule]): [string, string, string, Operation] => [
        operation.name,
        value,
        rule,
        operation,
      ]),
    )

  it.each(cases(DATE_OPERATIONS, DATES))(
    'refuses %s with the date %s as %s, before anything is looked for',
    async (_name, value, rule, operation) => {
      const response = await send(operation, value)

      expect(response.status).toBe(400)
      expect(response.body.code).toBe('2001')
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field: operation.field, rule }),
      )
    },
  )

  it.each(cases(MOMENT_OPERATIONS, MOMENTS))(
    'refuses %s with the moment %s as %s, before anything is looked for',
    async (_name, value, rule, operation) => {
      const response = await send(operation, value)

      expect(response.status).toBe(400)
      expect(response.body.code).toBe('2001')
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field: operation.field, rule }),
      )
    },
  )
})
