import {
  FAILED,
  from,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  REFUSED_PARTS,
  type RefusedValue,
  refusedValuesOf,
  UNANSWERED_PARTS,
  UNREAD_TYPES,
  type Unread,
  unreadOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
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
  bookingCrudReschedule,
  bookingCrudStart,
  bookingCrudUpdate,
  bookingServiceCrudCreate,
  bookingServiceCrudDelete,
  bookingServiceCrudGet,
  type ModelsAvailableSlotCheckRequest,
  type ModelsBookingCancelRequest,
  type ModelsBookingCompleteRequest,
  type ModelsBookingCreateRequest,
  type ModelsBookingRescheduleRequest,
  type ModelsBookingResponse,
  type ModelsBookingServiceCreateRequest,
  type ModelsBookingServiceResponse,
  type ModelsBookingUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import type { DayConditions } from '../utils/booking-day'
import {
  type AdditionAttempt,
  isMovable,
  type LineRemovalAttempt,
  lineRequestOf,
  type MoveAttempt,
  mayAddLine,
  mayRemoveLine,
  movedLines,
} from '../utils/booking-moves'

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

/** What came of moving a booking to another time, with another member of the staff perhaps. */
export type BookingMove =
  | { type: 'moved'; booking: ModelsBookingResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /**
   * The booking is in a state that is not moved any more, or a member of
   * the staff is taken at a time it would have, or the time zone of the
   * salon is no name. The API says which in a sentence only
   */
  | { type: 'conflict' }
  | NotFound
  | Forbidden
  | Unread

/** What came of adding a line to a booking. */
export type LineAddition =
  | { type: 'added'; line: ModelsBookingServiceResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /**
   * The booking is finished, or has the most lines it takes, or the line
   * begins too long after the first, or its member is taken, or the
   * booking cannot be summed up again. The API says which in a sentence only
   */
  | { type: 'conflict' }
  | NotFound
  | Forbidden
  | Unread

export type LineRead =
  | { type: 'found'; line: ModelsBookingServiceResponse }
  /** No line of the booking has the ID, or the booking is not found */
  | NotFound
  | Forbidden
  | Unread

/** What came of taking a line away from a booking. */
export type LineRemoval =
  | { type: 'deleted' }
  /**
   * The booking is finished, or the line is its last, or the booking
   * cannot be summed up again without it
   */
  | { type: 'conflict' }
  | NotFound
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

/** The key of a line of a booking. */
export const lineKeyOf = (bookingId: string, lineId: string): string[] => [
  ...bookingKeyOf(bookingId),
  'services',
  lineId,
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
    .with(P.union(...REFUSED_PARTS), unreadOf)
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
    .with(P.union(...REFUSED_PARTS), unreadOf)
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
    .with(P.union(...REFUSED_PARTS), unreadOf)
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
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
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
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
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
    .with(P.union(...REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * Moves a booking: every line by as much as the booking, and the lines of
 * its member to the new member. The API checks that the member belongs to
 * the salon and that nobody is taken beyond what they take at once.
 */
export const rescheduleBooking = async (
  id: string,
  request: ModelsBookingRescheduleRequest,
): Promise<BookingMove> => {
  const answer = await bookingCrudReschedule(id, request).catch(() => null)

  return match(answer)
    .returnType<BookingMove>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'moved',
      booking: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'conflict' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * Adds a line to a booking that is not finished. The API sums the booking
 * up again: its times and its amounts are those of its lines.
 */
export const addBookingLine = async (
  bookingId: string,
  request: ModelsBookingServiceCreateRequest,
): Promise<LineAddition> => {
  const answer = await bookingServiceCrudCreate(bookingId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<LineAddition>()
    .with({ status: 201 }, ({ data }) => ({ type: 'added', line: data.data }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'conflict' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** A line of a booking of an address. What is no ID is not asked for, as with a booking. */
export const readBookingLine = async (
  bookingId: string,
  id: string,
): Promise<LineRead> => {
  if (
    !idSchema.safeParse(bookingId).success ||
    !idSchema.safeParse(id).success
  ) {
    return NOT_FOUND
  }
  const answer = await bookingServiceCrudGet(bookingId, id).catch(() => null)

  return match(answer)
    .returnType<LineRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', line: data.data }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** Takes a line away from a booking that is not finished and has another. */
export const deleteBookingLine = async (
  bookingId: string,
  id: string,
): Promise<LineRemoval> => {
  const answer = await bookingServiceCrudDelete(bookingId, id).catch(() => null)

  return match(answer)
    .returnType<LineRemoval>()
    .with({ status: 204 }, () => ({ type: 'deleted' }))
    .with({ status: 409 }, () => ({ type: 'conflict' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...REFUSED_PARTS), unreadOf)
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
    .with(P.union(...REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * Whether the member of a line is free for its service from its beginning,
 * with the bookings that overlap it. The API names those by their IDs: each
 * is read, and one that is gone meanwhile is left out.
 *
 * A line of a booking that is in the ledger already (moved, or added to
 * it) overlaps the booking itself, which the API does not count against
 * it: that booking is `excluding`, and is no other booking that overlaps.
 * A member it alone took is free.
 */
export const checkLine = async (
  salonId: string,
  { serviceId, staffId, startTime }: ModelsBookingServiceCreateRequest,
  excluding?: string,
): Promise<LineCheck> => {
  if (staffId === null) {
    return { type: 'unassigned' }
  }
  const check = await checkSlot(salonId, { staffId, serviceId, startTime })
  if (check.type !== 'checked') {
    return check
  }
  const others = check.conflicts.filter((id) => id !== excluding)
  if (others.length === 0) {
    return { type: 'free', overlapping: [] }
  }
  const reads = await Promise.all(others.map(readBooking))
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

/**
 * Moves a booking, and finds out why the API refused it when it did: the
 * booking is read again, and in a state that is still moved, each line is
 * checked where it would be, the booking itself left out. A member found
 * taken is the reason; a check that could not be made leaves the reason
 * unknown, and is said as the failure it was; with every member free, the
 * API refused for a reason the screens cannot mend (the time zone of the
 * salon).
 */
export const attemptMove = async (
  salonId: string,
  bookingId: string,
  request: ModelsBookingRescheduleRequest,
): Promise<MoveAttempt> => {
  const outcome = await rescheduleBooking(bookingId, request)
  if (outcome.type !== 'conflict') {
    return outcome
  }
  const now = await readBooking(bookingId)
  if (now.type !== 'found') {
    return now
  }
  if (!isMovable(now.booking)) {
    return { type: 'unmovable', booking: now.booking }
  }
  const checks = await Promise.all(
    movedLines(now.booking, request).map((line) =>
      checkLine(salonId, lineRequestOf(line), bookingId),
    ),
  )

  if (checks.some(({ type }) => type === 'taken')) {
    return { type: 'taken', checks }
  }

  return whyUnread(checks)
}

/**
 * Adds a line to a booking, and finds out why the API refused it when it
 * did: the booking is read again, and while it takes lines still, the
 * member of the line is checked, the booking itself left out. The day of
 * the line is checked before it is sent.
 */
export const attemptAddition = async (
  salonId: string,
  bookingId: string,
  request: ModelsBookingServiceCreateRequest,
): Promise<AdditionAttempt> => {
  const outcome = await addBookingLine(bookingId, request)
  if (outcome.type === 'added') {
    return { type: 'added' }
  }
  if (outcome.type !== 'conflict') {
    return outcome
  }
  const now = await readBooking(bookingId)
  if (now.type !== 'found') {
    return now
  }
  if (!mayAddLine(now.booking)) {
    return { type: 'unaddable', booking: now.booking }
  }
  const check = await checkLine(salonId, request, bookingId)

  return match(check)
    .returnType<AdditionAttempt>()
    .with({ type: 'taken' }, () => ({ type: 'taken', check }))
    .with({ type: P.union('free', 'unassigned') }, () => ({ type: 'tooMuch' }))
    .with({ type: P.union(...UNREAD_TYPES) }, (unread) => unread)
    .exhaustive()
}

/**
 * Takes a line away, and finds out why the API refused it when it did:
 * the booking is read again, and has changed meanwhile when the line is
 * no longer taken away.
 */
export const attemptLineRemoval = async (
  bookingId: string,
  lineId: string,
): Promise<LineRemovalAttempt> => {
  const outcome = await deleteBookingLine(bookingId, lineId)
  if (outcome.type !== 'conflict') {
    return outcome
  }
  const now = await readBooking(bookingId)
  if (now.type !== 'found') {
    return now
  }

  return mayRemoveLine(now.booking)
    ? { type: 'unsummed' }
    : { type: 'refused', booking: now.booking }
}
