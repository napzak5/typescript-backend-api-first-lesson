import type {
  ModelsBookingResponse,
  ModelsCustomerResponse,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import type { CustomersRead } from '../customers/customers-api'
import { aBooking, aCustomer, services, staff } from './components/examples'
import {
  customerIdsOf,
  type Names,
  rowsOf,
  serviceNamesOf,
  staffNameOf,
} from './day-bookings'

const HANAKO = aCustomer({ id: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9d01' })
const GONE_ID = '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9d02'

const STAFF: Names['staff'] = staff

const SERVICES: Names['services'] = services

const customersOf = (
  ...customers: ModelsCustomerResponse[]
): CustomersRead => ({
  type: 'found',
  customers: new Map(customers.map((customer) => [customer.id, customer])),
})

const first = aBooking({
  id: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9a01',
  customerId: HANAKO.id,
})
const second = aBooking({
  id: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9a02',
  customerId: GONE_ID,
  staffId: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9e09',
})
const third = aBooking({
  id: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9a03',
  customerId: HANAKO.id,
})

const namesWith = (
  customers: (booking: ModelsBookingResponse) => CustomersRead | undefined,
): Names => ({ staff: STAFF, services: SERVICES, customers })

describe('rowsOf', () => {
  it('should name the customer, the member of the staff and the services of each booking', () => {
    const { rows, rest } = rowsOf(
      [first, second],
      namesWith(() => customersOf(HANAKO)),
    )

    expect(rest).toEqual({ type: 'none' })
    expect(
      rows.map(({ booking, customer, staffName, serviceNames }) => ({
        id: booking.id,
        customer,
        staffName,
        serviceNames,
      })),
    ).toEqual([
      {
        id: first.id,
        customer: HANAKO,
        staffName: '田中 美咲',
        serviceNames: ['カット'],
      },
      // The customer was removed, and the salon no longer shows the member
      {
        id: second.id,
        customer: null,
        staffName: null,
        serviceNames: ['カット'],
      },
    ])
  })

  it('should end the rows at the first booking whose customers are on their way', () => {
    const { rows, rest } = rowsOf(
      [first, second, third],
      namesWith((booking) =>
        booking.id === second.id ? undefined : customersOf(HANAKO),
      ),
    )

    expect(rows.map(({ booking }) => booking.id)).toEqual([first.id])
    expect(rest).toEqual({ type: 'reading' })
  })

  it('should end the rows at the first booking whose customers could not be read', () => {
    const { rows, rest } = rowsOf(
      [first, second, third],
      namesWith((booking) =>
        booking.id === first.id
          ? customersOf(HANAKO)
          : { type: 'tooManyRequests' },
      ),
    )

    expect(rows.map(({ booking }) => booking.id)).toEqual([first.id])
    expect(rest).toEqual({
      type: 'unread',
      reason: { type: 'tooManyRequests' },
    })
  })
})

describe('serviceNamesOf', () => {
  it('should name the services in the order of the booking, and say which were removed', () => {
    const [line] = first.services
    if (line === undefined) {
      throw new Error('The example booking has a service')
    }
    const booking = aBooking({
      services: [
        {
          ...line,
          serviceId: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9f99',
          sortOrder: 2,
        },
        { ...line, serviceId: SERVICES[1]?.id ?? '', sortOrder: 0 },
        { ...line, serviceId: SERVICES[0]?.id ?? '', sortOrder: 1 },
      ],
    })

    expect(serviceNamesOf(booking, SERVICES)).toEqual([
      'カラー',
      'カット',
      null,
    ])
  })
})

describe('staffNameOf', () => {
  it.each([
    ['a member the salon shows', STAFF[0]?.id ?? '', '田中 美咲'],
    ['a member the salon does not show', GONE_ID, null],
    ['no member', null, null],
  ])('should name %s', (_case, staffId, name) => {
    expect(staffNameOf(staffId, STAFF)).toBe(name)
  })
})

describe('customerIdsOf', () => {
  it('should name each customer once, in their order', () => {
    expect(customerIdsOf([first, second, third])).toEqual([HANAKO.id, GONE_ID])
  })
})
