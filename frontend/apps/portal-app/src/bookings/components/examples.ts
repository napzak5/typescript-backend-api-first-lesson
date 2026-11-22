import type { ModelsCustomerBookingResponse } from '@beauty-salon-frontend/api-client'
import { plainSalon, salon, staff } from '../../salons/components/examples'
import type { Time } from '../utils/booking-choice'
import type { Row } from '../utils/own-bookings'

/*
 * What the stories of the booking components show: the salon, the services
 * and the staff of the stories of the salons, and a day of that salon.
 */

/** The day the stories are told on, at the salon, and the day they book */
export const TODAY = '2026-11-19'
export const DAY = '2026-11-24'

/** The members of the staff who take bookings */
export const bookableStaff = staff.filter((member) => member.canReceiveBookings)

const MS_OF_A_MINUTE = 60 * 1000

/** A moment of the day that is booked, so many minutes after 10:00 at the salon (01:00 UTC). */
const moment = (minutes: number): string =>
  new Date(
    Date.parse(`${DAY}T01:00:00.000Z`) + minutes * MS_OF_A_MINUTE,
  ).toISOString()

const timeOfDay = (minutes: number): string =>
  `${String(10 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Every half hour from 10:00 to 16:30: the afternoon has one member of the staff. */
export const times: Time[] = Array.from({ length: 14 }, (_, index) => {
  const minutes = index * 30

  return {
    startTime: moment(minutes),
    label: timeOfDay(minutes),
    staffIds: bookableStaff
      .slice(0, minutes < 180 ? 2 : 1)
      .map((member) => member.id),
  }
})

/** The cut of the stories of the salons, and the member of its staff who cuts */
const SERVICE_ID = '1a3c5e7f-9b20-4d46-8e68-0a2c4e6f8b79'
const STAFF_ID = '6f81a3c4-e075-429b-93bd-5f7193acc0ce'

/** A booking that waits for the salon: a cut at 10:30, with what the customer asks for. */
export const booking: ModelsCustomerBookingResponse = {
  id: 'e7092b3c-68fd-4a13-9b35-d7f902245846',
  bookingNumber: 'BK-7M3K-Q9XD',
  salonId: salon.id,
  staffId: STAFF_ID,
  bookingDate: DAY,
  startTime: moment(30),
  endTime: moment(90),
  duration: 60,
  status: 'pending',
  subtotal: 5500,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 5500,
  depositAmount: null,
  pointsUsed: null,
  pointsEarned: null,
  customerRequest: '前髪は、眉が隠れるくらいの長さにしたいです。',
  cancelledAt: null,
  cancellationFee: null,
  completedAt: null,
  services: [
    {
      id: 'f81a3c4d-790e-4b24-8c46-e80a13356957',
      serviceId: SERVICE_ID,
      staffId: STAFF_ID,
      startTime: moment(30),
      endTime: moment(90),
      duration: 60,
      price: 5500,
      discountAmount: 0,
      finalPrice: 5500,
      taxIncluded: true,
      sortOrder: 0,
    },
  ],
  createdAt: '2026-11-19T03:20:00.000Z',
  updatedAt: '2026-11-19T03:20:00.000Z',
}

/** When the booking of the stories is, as a sentence names it */
export const WHEN = '2026年11月24日火曜日 10:30〜11:30'

/**
 * The bookings of a list, the earliest visit first: the cut that waits for
 * the salon, a colour that the salon confirmed, and a visit to another
 * salon that was cancelled.
 */
export const rows: Row[] = [
  { booking, salon, serviceName: 'レディースカット' },
  {
    booking: {
      ...booking,
      id: '0a13c5d7-9e2f-4b46-8d68-fa1c3e5072b4',
      bookingNumber: 'BK-2R8T-W4HN',
      bookingDate: '2026-12-08',
      startTime: '2026-12-08T05:00:00.000Z',
      endTime: '2026-12-08T07:00:00.000Z',
      duration: 120,
      status: 'confirmed',
    },
    salon,
    serviceName: 'フルカラー',
  },
  {
    booking: {
      ...booking,
      id: '1b24d6e8-af30-4c57-9e79-0b2d4f6183c5',
      bookingNumber: 'BK-5C9V-J2PL',
      salonId: plainSalon.id,
      bookingDate: '2026-12-19',
      startTime: '2026-12-19T02:00:00.000Z',
      endTime: '2026-12-19T02:40:00.000Z',
      duration: 40,
      status: 'cancelled',
      cancelledAt: '2026-11-20T00:00:00.000Z',
    },
    salon: plainSalon,
    serviceName: 'カット',
  },
]

/** A booking whose salon is no longer there: its day is all that is told of when it is */
export const rowWithoutNames: Row = {
  booking: {
    ...booking,
    id: '2c35e7f9-b041-4d68-8f8a-1c3e507294d6',
    bookingNumber: 'BK-8F3X-M6QR',
    bookingDate: '2026-12-22',
    startTime: '2026-12-22T04:00:00.000Z',
    endTime: '2026-12-22T05:00:00.000Z',
    status: 'confirmed',
  },
  salon: null,
  serviceName: null,
}
