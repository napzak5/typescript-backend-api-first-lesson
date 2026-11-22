import {
  FAILED,
  from,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  TOO_MANY_REQUESTS,
  toTheEnd,
  UNANSWERED_PARTS,
  type Unread,
  type Unsent,
} from '@beauty-salon-frontend/answers'
import {
  availableSlotCrudList,
  type CustomerBookingsListParams,
  customerBookingsCancel,
  customerBookingsCreate,
  customerBookingsGet,
  customerBookingsList,
  customerBookingsReschedule,
  type ModelsAvailableSlotResponse,
  type ModelsBookingCancelRequest,
  type ModelsBookingRescheduleRequest,
  type ModelsCustomerBookingCreateRequest,
  type ModelsCustomerBookingResponse,
  type ModelsServiceResponse,
  serviceCrudGet,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { unansweredOf } from '../../session/utils/behind-the-session'

export type ServiceRead =
  | { type: 'found'; service: ModelsServiceResponse }
  | NotFound
  | Unread

export type SlotsRead =
  | { type: 'found'; slots: ModelsAvailableSlotResponse[] }
  | Unread

export type Booking =
  | { type: 'booked'; booking: ModelsCustomerBookingResponse }
  /**
   * The API does not take the booking, and does not say why: the time is no
   * longer free, the customer has another booking then, or may not book
   */
  | { type: 'refused' }
  /** The profile is gone since the screen read it */
  | { type: 'noProfile' }
  /** What was chosen names something that is no longer there */
  | { type: 'invalid' }
  | Unsent

export type OwnBookingRead =
  | { type: 'found'; booking: ModelsCustomerBookingResponse }
  | NotFound
  | Unread

export type Cancellation =
  | { type: 'cancelled'; booking: ModelsCustomerBookingResponse }
  /**
   * The API does not cancel the booking, and does not say why: the salon
   * has changed its state in the meantime, or its time has come
   */
  | { type: 'refused' }
  /** The booking is no longer there */
  | NotFound
  | Unsent

export type Move =
  | { type: 'moved'; booking: ModelsCustomerBookingResponse }
  /**
   * The API does not move the booking, and does not say why: the time is no
   * longer free, the booking can no longer be changed, or it is one the
   * salon has to move
   */
  | { type: 'refused' }
  /** The booking is no longer there */
  | NotFound
  /** What was chosen names somebody who is no longer there */
  | { type: 'invalid' }
  | Unsent

const NOT_FOUND: NotFound = { type: 'notFound' }

const idSchema = z.uuid()

const isId = (value: string): boolean => idSchema.safeParse(value).success

/**
 * A service of a salon, by the IDs of an address. What is no ID is not
 * asked for: the API would answer that it takes no such value.
 */
export const readService = async (
  salonId: string,
  serviceId: string,
): Promise<ServiceRead> => {
  if (!isId(salonId) || !isId(serviceId)) {
    return NOT_FOUND
  }
  const answer = await serviceCrudGet(salonId, serviceId).catch(() => null)

  return match(answer)
    .returnType<ServiceRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      service: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(P.union(null, { status: 400 }, { status: 500 }), () => FAILED)
    .exhaustive(outsideTheContract)
}

/** The largest page the API gives: the times of a day are read to their end. */
const LARGEST_PAGE = 100

/** Which times are asked for: of a service, on a day of the salon, with one member of the staff or with anybody. */
export type SlotsAsked = {
  salonId: string
  serviceId: string
  /** The calendar date at the salon: `2026-11-23` */
  date: string
  /** `undefined` for the times of everybody */
  staffId: string | undefined
  /**
   * How long the visit takes, in minutes, when that is not what the
   * service takes now: a booking that is moved keeps its length
   */
  duration: number | undefined
}

const readSlotsPage = async (
  { salonId, serviceId, date, staffId, duration }: SlotsAsked,
  cursor: string | undefined,
): Promise<Page<ModelsAvailableSlotResponse> | Unread> => {
  const answer = await availableSlotCrudList(salonId, {
    ...from(cursor),
    ...(staffId === undefined ? {} : { staffId }),
    ...(duration === undefined ? {} : { duration }),
    serviceId,
    date,
    limit: LARGEST_PAGE,
  }).catch(() => null)

  return (
    match(answer)
      .returnType<Page<ModelsAvailableSlotResponse> | Unread>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 429 }, () => TOO_MANY_REQUESTS)
      // The screen asks for what it has read: a salon, a service and a member
      // of its staff. An answer that refuses one of them is no answer to act on
      .with(
        P.union(
          null,
          { status: 400 },
          { status: 401 },
          { status: 403 },
          { status: 404 },
          { status: 409 },
          { status: 500 },
        ),
        () => FAILED,
      )
      .exhaustive(outsideTheContract)
  )
}

/**
 * The times at which the service can begin on the day, the earliest first:
 * one for every member of the staff who is free then.
 */
export const readSlots = async (asked: SlotsAsked): Promise<SlotsRead> => {
  const slots = await toTheEnd((cursor) => readSlotsPage(asked, cursor))

  return slots.type === 'found' ? { type: 'found', slots: slots.items } : slots
}

/** Books a time for the customer of the account. The booking waits for the salon to confirm it. */
export const book = async (
  request: ModelsCustomerBookingCreateRequest,
): Promise<Booking> => {
  const answer = await customerBookingsCreate(request).catch(() => null)

  return match(answer)
    .returnType<Booking>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'booked',
      booking: data.data,
    }))
    .with({ status: 409 }, () => ({ type: 'refused' }))
    .with({ status: 404 }, () => ({ type: 'noProfile' }))
    .with({ status: 400 }, () => ({ type: 'invalid' }))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(
        null,
        { status: 401 },
        { status: 403 },
        { status: 413 },
        { status: 415 },
        { status: 500 },
      ),
      () => FAILED,
    )
    .exhaustive(outsideTheContract)
}

/**
 * A booking of the customer of the account. The booking of somebody else is
 * not told from one that does not exist, and neither is an ID that is none.
 */
export const readOwnBooking = async (id: string): Promise<OwnBookingRead> => {
  if (!isId(id)) {
    return NOT_FOUND
  }
  const answer = await customerBookingsGet(id).catch(() => null)

  return match(answer)
    .returnType<OwnBookingRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      booking: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 400 }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS, { status: 403 }), unansweredOf)
    .exhaustive(outsideTheContract)
}

/** Which visits a list of bookings is asked for: from a day on, or until a day. */
export type OwnBookingsAsked = Pick<
  CustomerBookingsListParams,
  'bookingDateFrom' | 'bookingDateTo'
>

/** How many bookings a page of the list has */
const BOOKINGS_PER_PAGE = 20

/** An account that has not said who its customer is has booked nothing */
const NO_BOOKINGS: Page<ModelsCustomerBookingResponse> = {
  type: 'found',
  items: [],
  total: 0,
  nextCursor: null,
}

const readOwnBookingsPage = async (
  asked: OwnBookingsAsked,
  cursor: string | undefined,
  limit: number,
): Promise<Page<ModelsCustomerBookingResponse> | Unread> => {
  const answer = await customerBookingsList({
    ...from(cursor),
    ...asked,
    limit,
  }).catch(() => null)

  return match(answer)
    .returnType<Page<ModelsCustomerBookingResponse> | Unread>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 404 }, () => NO_BOOKINGS)
    .with({ status: 400 }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS, { status: 403 }), unansweredOf)
    .exhaustive(outsideTheContract)
}

/**
 * A page of the bookings of the customer of the account, the earliest visit
 * first. The API has no other order.
 */
export const readOwnBookings = (
  asked: OwnBookingsAsked,
  cursor: string | undefined,
): Promise<Page<ModelsCustomerBookingResponse> | Unread> =>
  readOwnBookingsPage(asked, cursor, BOOKINGS_PER_PAGE)

export type BookedSalonsRead = { type: 'found'; salonIds: string[] } | Unread

/**
 * The salons the customer of the account has a booking at, each once:
 * visits that are to come, visits that were, and bookings that were
 * cancelled. An account that has not said who its customer is has none.
 */
export const readBookedSalonIds = async (): Promise<BookedSalonsRead> => {
  const bookings = await toTheEnd((cursor) =>
    readOwnBookingsPage({}, cursor, LARGEST_PAGE),
  )

  return bookings.type === 'found'
    ? {
        type: 'found',
        salonIds: [...new Set(bookings.items.map(({ salonId }) => salonId))],
      }
    : bookings
}

/** Cancels a booking of the customer. A booking that was cancelled stays cancelled. */
export const cancelOwnBooking = async (
  id: string,
  request: ModelsBookingCancelRequest,
): Promise<Cancellation> => {
  const answer = await customerBookingsCancel(id, request).catch(() => null)

  return match(answer)
    .returnType<Cancellation>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'cancelled',
      booking: data.data,
    }))
    .with({ status: 409 }, () => ({ type: 'refused' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(
        null,
        { status: 400 },
        { status: 401 },
        { status: 403 },
        { status: 413 },
        { status: 415 },
        { status: 500 },
      ),
      () => FAILED,
    )
    .exhaustive(outsideTheContract)
}

/**
 * Moves a booking of the customer to another time that is free, with the
 * same member of the staff or with another.
 */
export const moveOwnBooking = async (
  id: string,
  request: ModelsBookingRescheduleRequest,
): Promise<Move> => {
  const answer = await customerBookingsReschedule(id, request).catch(() => null)

  return match(answer)
    .returnType<Move>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'moved',
      booking: data.data,
    }))
    .with({ status: 409 }, () => ({ type: 'refused' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 400 }, () => ({ type: 'invalid' }))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(
        null,
        { status: 401 },
        { status: 403 },
        { status: 413 },
        { status: 415 },
        { status: 500 },
      ),
      () => FAILED,
    )
    .exhaustive(outsideTheContract)
}
