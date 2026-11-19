import {
  availableSlotCrudList,
  type CustomerBookingsListParams,
  customerBookingsCancel,
  customerBookingsCreate,
  customerBookingsGet,
  customerBookingsList,
  customerBookingsReschedule,
  customerProfileCreate,
  customerProfileGet,
  type ModelsAvailableSlotResponse,
  type ModelsBookingCancelRequest,
  type ModelsBookingRescheduleRequest,
  type ModelsCustomerBookingCreateRequest,
  type ModelsCustomerBookingResponse,
  type ModelsCustomerProfileCreateRequest,
  type ModelsCustomerProfileResponse,
  type ModelsProblemDetails,
  type ModelsServiceResponse,
  serviceCrudGet,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { outsideTheContract } from '../outside-the-contract'
import {
  from,
  type NotFound,
  type Page,
  pageOf,
  toTheEnd,
  type Unread,
} from '../salons/salons-api'

/** A value the API does not take: the property, and the rule it broke. */
export type RefusedValue = { field: string; rule: string }

/** Why nothing came of a request to write, besides what the request itself may be refused for. */
type Unsent =
  | { type: 'tooManyRequests' }
  /** No answer, or one that says nothing a person could act on */
  | { type: 'failed' }

export type ProfileRead =
  | { type: 'found'; profile: ModelsCustomerProfileResponse }
  /** The account has no profile yet: nobody has said who the customer is */
  | { type: 'none' }
  | Unread

export type ProfileCreation =
  | { type: 'created'; profile: ModelsCustomerProfileResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /**
   * The account cannot have this profile: it has one, its address is not
   * confirmed, or the customer of its address belongs to another account
   */
  | { type: 'refused' }
  | Unsent

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

type Problem<Status extends number> = {
  status: Status
  data: ModelsProblemDetails
}

const NOT_FOUND: NotFound = { type: 'notFound' }

const FAILED: { type: 'failed' } = { type: 'failed' }

const TOO_MANY_REQUESTS: { type: 'tooManyRequests' } = {
  type: 'tooManyRequests',
}

/**
 * The answers that say nothing about what was asked for, and no answer at
 * all. 401 and 403 are among them: the screens of this module stand behind
 * the guard of the session, which shows the sign-in screen when the session
 * has ended, and an account of another role never gets to them.
 */
type Unanswered =
  | Problem<401>
  | Problem<403>
  | Problem<429>
  | Problem<500>
  | null

const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 403 },
  { status: 429 },
  { status: 500 },
)

const unansweredOf = (answer: Unanswered): Unread =>
  match(answer)
    .returnType<Unread>()
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(null, { status: 401 }, { status: 403 }, { status: 500 }),
      () => FAILED,
    )
    .exhaustive()

/**
 * Why a part of a screen that reads several things is not shown: too many
 * requests when one of them was refused for that, which waiting mends and
 * looking at the connection does not.
 */
export const whyUnread = (
  reads: readonly ({ type: string } | undefined)[],
): Unread =>
  reads.some((read) => read?.type === 'tooManyRequests')
    ? TOO_MANY_REQUESTS
    : FAILED

const idSchema = z.uuid()

const isId = (value: string): boolean => idSchema.safeParse(value).success

/** The profile of the account that is signed in: who the customer is. */
export const readOwnProfile = async (): Promise<ProfileRead> => {
  const answer = await customerProfileGet().catch(() => null)

  return match(answer)
    .returnType<ProfileRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      profile: data.data,
    }))
    .with({ status: 404 }, () => ({ type: 'none' }))
    .with(UNANSWERED, unansweredOf)
    .exhaustive(outsideTheContract)
}

/** Makes the account a customer: with a new record, or with the one the ledger has for its address. */
export const createOwnProfile = async (
  request: ModelsCustomerProfileCreateRequest,
): Promise<ProfileCreation> => {
  const answer = await customerProfileCreate(request).catch(() => null)

  return match(answer)
    .returnType<ProfileCreation>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'created',
      profile: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: (data.errors ?? []).map(({ field, rule }) => ({ field, rule })),
    }))
    .with({ status: 409 }, () => ({ type: 'refused' }))
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
    .with(UNANSWERED, unansweredOf)
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

/**
 * A page of the bookings of the customer of the account, the earliest visit
 * first. The API has no other order.
 */
export const readOwnBookings = async (
  asked: OwnBookingsAsked,
  cursor: string | undefined,
): Promise<Page<ModelsCustomerBookingResponse> | Unread> => {
  const answer = await customerBookingsList({
    ...from(cursor),
    ...asked,
    limit: BOOKINGS_PER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<Page<ModelsCustomerBookingResponse> | Unread>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 404 }, () => NO_BOOKINGS)
    .with({ status: 400 }, () => FAILED)
    .with(UNANSWERED, unansweredOf)
    .exhaustive(outsideTheContract)
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
