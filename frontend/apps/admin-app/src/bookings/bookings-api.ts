import {
  bookingCrudCancel,
  bookingCrudComplete,
  bookingCrudConfirm,
  bookingCrudGet,
  bookingCrudList,
  bookingCrudNoShow,
  bookingCrudStart,
  type ModelsBookingCancelRequest,
  type ModelsBookingCompleteRequest,
  type ModelsBookingResponse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { outsideTheContract } from '../outside-the-contract'
import {
  FAILED,
  from,
  NOT_FOUND,
  type NotFound,
  type Page,
  pageOf,
  type Unread,
  unreadOf,
} from '../reading'
import type { DayConditions } from './booking-day'

/** The account may not see the bookings of the salon: a member of another one. */
export type Forbidden = { type: 'forbidden' }

export type BookingPage = Page<ModelsBookingResponse> | Forbidden | Unread

export type BookingRead =
  | { type: 'found'; booking: ModelsBookingResponse }
  /** No booking has the ID, or it is one of another salon, or it was removed */
  | NotFound
  | Forbidden
  | Unread

/** What came of an operation that changes the state of a booking. */
export type StatusChange =
  | { type: 'changed'; booking: ModelsBookingResponse }
  /**
   * The booking is no longer in a state the operation is for, or its time
   * has not come (a booking nobody came to): it changed elsewhere
   */
  | { type: 'conflict' }
  | NotFound
  | Forbidden
  | Unread

/** How many bookings a page of the list has. */
const BOOKINGS_PER_PAGE = 50

const FORBIDDEN: Forbidden = { type: 'forbidden' }

const CONFLICT: StatusChange = { type: 'conflict' }

/** The answers that say nothing about the booking, as a pattern */
const REFUSED = P.union(
  null,
  { status: 400 },
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

/** The keys of what the screens read of the bookings of a salon. */
export const bookingListsKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'bookings',
  'lists',
]

export const bookingKeyOf = (bookingId: string): string[] => [
  'bookings',
  bookingId,
]

/**
 * The bookings of a salon on a day, a page at a time, in the order they
 * begin. A member of the staff of another salon is refused.
 */
export const readDayBookings = async (
  salonId: string,
  { date, status, staffId }: DayConditions,
  cursor: string | undefined,
): Promise<BookingPage> => {
  const answer = await bookingCrudList({
    salonId,
    bookingDateFrom: date,
    bookingDateTo: date,
    ...(status === undefined ? {} : { status }),
    ...(staffId === undefined ? {} : { staffId }),
    ...from(cursor),
    limit: BOOKINGS_PER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<BookingPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 403 }, () => FORBIDDEN)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

const idSchema = z.uuid()

/**
 * A booking of an address. What is no ID is not asked for: the API would
 * answer that it takes no such value, which is no more than "not found".
 */
export const readBooking = async (id: string): Promise<BookingRead> => {
  if (!idSchema.safeParse(id).success) {
    return NOT_FOUND
  }
  const answer = await bookingCrudGet(id).catch(() => null)

  return match(answer)
    .returnType<BookingRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      booking: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

type StatusAnswer =
  | Awaited<ReturnType<typeof bookingCrudConfirm>>
  | Awaited<ReturnType<typeof bookingCrudStart>>
  | Awaited<ReturnType<typeof bookingCrudNoShow>>
  | Awaited<ReturnType<typeof bookingCrudComplete>>
  | Awaited<ReturnType<typeof bookingCrudCancel>>

/**
 * What an operation answered. A body that the API did not read (413, 415)
 * says nothing a person could act on: the screens send what it takes.
 */
const statusChangeOf = (answer: StatusAnswer | null): StatusChange =>
  match(answer)
    .returnType<StatusChange>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'changed',
      booking: data.data,
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)

/** Confirms a booking that waits for it (`draft`, `pending`). */
export const confirmBooking = async (id: string): Promise<StatusChange> =>
  statusChangeOf(await bookingCrudConfirm(id).catch(() => null))

/** Records that the treatment of a confirmed booking began. */
export const startBooking = async (id: string): Promise<StatusChange> =>
  statusChangeOf(await bookingCrudStart(id).catch(() => null))

/** Records that a booking was carried out, with when it actually was. */
export const completeBooking = async (
  id: string,
  request: ModelsBookingCompleteRequest,
): Promise<StatusChange> =>
  statusChangeOf(await bookingCrudComplete(id, request).catch(() => null))

/** Cancels a booking, with the reason if one was given. */
export const cancelBooking = async (
  id: string,
  request: ModelsBookingCancelRequest,
): Promise<StatusChange> =>
  statusChangeOf(await bookingCrudCancel(id, request).catch(() => null))

/** Records that nobody came to a booking whose time has come. */
export const recordNoShow = async (id: string): Promise<StatusChange> =>
  statusChangeOf(await bookingCrudNoShow(id).catch(() => null))
