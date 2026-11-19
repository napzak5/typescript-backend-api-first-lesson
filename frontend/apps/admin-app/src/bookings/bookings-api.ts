import {
  availableSlotCrudCheck,
  bookingCrudCancel,
  bookingCrudComplete,
  bookingCrudConfirm,
  bookingCrudCreate,
  bookingCrudDelete,
  bookingCrudGet,
  bookingCrudList,
  bookingCrudNoShow,
  bookingCrudStart,
  bookingCrudUpdate,
  type ModelsAvailableSlotCheckRequest,
  type ModelsBookingCancelRequest,
  type ModelsBookingCompleteRequest,
  type ModelsBookingCreateRequest,
  type ModelsBookingResponse,
  type ModelsBookingServiceCreateRequest,
  type ModelsBookingUpdateRequest,
  type ModelsProblemDetails,
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
type Forbidden = { type: 'forbidden' }

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

/** A value the API refused, with the rule it broke. */
export type RefusedValue = { field: string; rule: string }

/** What came of creating a booking. */
export type BookingCreation =
  | { type: 'created'; booking: ModelsBookingResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /**
   * A member of the staff is taken at a time of the booking beyond what
   * they take at once; or the time zone of the salon is no name, which
   * the screens of the salon could not show either. The API says which in
   * a sentence only
   */
  | { type: 'conflict' }
  | Forbidden
  | Unread

/** What came of changing what the salon wrote down on a booking. */
export type BookingUpdate =
  | { type: 'updated'; booking: ModelsBookingResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  | NotFound
  | Forbidden
  | Unread

/** What came of removing a booking from the ledger. */
export type BookingRemoval =
  | { type: 'deleted' }
  /** A sale, a treatment record or a review refers to the booking: the visit took place */
  | { type: 'referred' }
  | NotFound
  /** A member of the staff, who cancels a booking instead */
  | Forbidden
  | Unread

/** Whether a member of the staff is free for a service at a time. */
export type SlotCheck =
  | {
      type: 'checked'
      /** A booking would not be refused for the member being taken */
      isAvailable: boolean
      /** The bookings that overlap the time, those that begin first first */
      conflicts: string[]
    }
  | Unread

/** What was found out about the member of the staff of a line of a booking. */
export type LineCheck =
  /** The line has no member: it takes nobody's time */
  | { type: 'unassigned' }
  /**
   * The member is free; bookings may overlap the time still, when the
   * member takes more than one at once
   */
  | { type: 'free'; overlapping: ModelsBookingResponse[] }
  /** The member is taken by the bookings that overlap the time */
  | { type: 'taken'; overlapping: ModelsBookingResponse[] }
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

/** The same, for a request whose 400 names the values it refused */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const refusedValuesOf = ({
  errors,
}: Pick<ModelsProblemDetails, 'errors'>): RefusedValue[] =>
  (errors ?? []).map(({ field, rule }) => ({ field, rule }))

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

/**
 * Puts a booking into the ledger of a salon. The API checks that what it
 * names belongs to the salon and that no member of the staff is taken
 * beyond what they take at once; nothing else.
 */
export const createBooking = async (
  request: ModelsBookingCreateRequest,
): Promise<BookingCreation> => {
  const answer = await bookingCrudCreate(request).catch(() => null)

  return match(answer)
    .returnType<BookingCreation>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'created',
      booking: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'conflict' }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** Changes what the salon wrote down on a booking: the properties named, and no other. */
export const updateBooking = async (
  id: string,
  request: ModelsBookingUpdateRequest,
): Promise<BookingUpdate> => {
  const answer = await bookingCrudUpdate(id, request).catch(() => null)

  return match(answer)
    .returnType<BookingUpdate>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'updated',
      booking: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** Removes a booking that should not be in the ledger, with its lines. */
export const deleteBooking = async (id: string): Promise<BookingRemoval> => {
  const answer = await bookingCrudDelete(id).catch(() => null)

  return match(answer)
    .returnType<BookingRemoval>()
    .with({ status: 204 }, () => ({ type: 'deleted' }))
    .with({ status: 409 }, () => ({ type: 'referred' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * Whether a member of the staff of a salon is free for a service from a
 * moment on. Only whether they are taken is checked, as the ledger does.
 * A member or a service the salon no longer has is no answer a person
 * could act on here: the form offers those the salon has.
 */
export const checkSlot = async (
  salonId: string,
  request: ModelsAvailableSlotCheckRequest,
): Promise<SlotCheck> => {
  const answer = await availableSlotCrudCheck(salonId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<SlotCheck>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'checked',
      isAvailable: data.data.isAvailable,
      conflicts: data.data.conflicts,
    }))
    .with({ status: P.union(403, 404, 413, 415) }, () => FAILED)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * Whether the member of a line is free for its service from its beginning,
 * with the bookings that overlap it. The API names those by their IDs: each
 * is read, and one that is gone meanwhile is left out.
 */
export const checkLine = async (
  salonId: string,
  { serviceId, staffId, startTime }: ModelsBookingServiceCreateRequest,
): Promise<LineCheck> => {
  if (staffId === null) {
    return { type: 'unassigned' }
  }
  const check = await checkSlot(salonId, { staffId, serviceId, startTime })
  if (check.type !== 'checked') {
    return check
  }
  const reads = await Promise.all(check.conflicts.map(readBooking))
  const unread = reads.find(
    (read) => read.type === 'tooManyRequests' || read.type === 'failed',
  )
  if (unread?.type === 'tooManyRequests' || unread?.type === 'failed') {
    return unread
  }
  const overlapping = reads.flatMap((read) =>
    read.type === 'found' ? [read.booking] : [],
  )

  return check.isAvailable
    ? { type: 'free', overlapping }
    : { type: 'taken', overlapping }
}
