import {
  FAILED,
  type Forbidden,
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  refusedValuesOf,
  toTheEnd,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsStaffCreateRequest,
  type ModelsStaffResponse,
  type ModelsStaffUpdateRequest,
  staffCrudCreate,
  staffCrudDelete,
  staffCrudGet,
  staffCrudList,
  staffCrudUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import type { StaffEntryAttempt, StaffWriteAttempt } from './staff-form'

/*
 * The staff ledger of a salon: the members it employs, as the owner of the
 * salon and an administrator keep them.
 */

const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The key every list of the ledger is read under: a write drops them all. */
export const STAFF_LISTS = ['staff']

/** The key a member is read under. */
export const staffKeyOf = (staffId: string): string[] => [
  'staff-member',
  staffId,
]

/** A page of the ledger, or why it was not read: the account may not keep the ledger of the salon. */
export type StaffPageRead = Page<ModelsStaffResponse> | Forbidden | Unread

/** A page of the members of a salon, in the order they were registered in. */
export const readStaffPage = async (
  salonId: string,
  cursor: string | undefined,
): Promise<StaffPageRead> => {
  const answer = await staffCrudList(salonId, from(cursor)).catch(() => null)

  return (
    match(answer)
      .returnType<StaffPageRead>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 403 }, () => FORBIDDEN)
      // The salon was read before, and the screens send only what the API takes
      .with(P.union({ status: 400 }, { status: 404 }), () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

export type StaffRead =
  | { type: 'found'; member: ModelsStaffResponse }
  /** No member of the salon has the ID, or the member was removed */
  | NotFound
  | Forbidden
  | Unread

/** A member of the staff of a salon. */
export const readStaffMember = async (
  salonId: string,
  staffId: string,
): Promise<StaffRead> => {
  const answer = await staffCrudGet(salonId, staffId).catch(() => null)

  return (
    match(answer)
      .returnType<StaffRead>()
      .with({ status: 200 }, ({ data }) => ({
        type: 'found',
        member: data.data,
      }))
      // An ID that is no ID names no member either
      .with({ status: P.union(400, 404) }, () => NOT_FOUND)
      .with({ status: 403 }, () => FORBIDDEN)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/** What came of a write of a member, as the API answered it. */
type StaffAnswer<Attempt extends StaffWriteAttempt> =
  | Exclude<Attempt, { type: 'duplicate' }>
  /** Another member has the address of mail or the staff code: the API says which in a sentence only */
  | { type: 'conflict' }

const CONFLICT: { type: 'conflict' } = { type: 'conflict' }

const OWN_RECORD: { type: 'ownRecord' } = { type: 'ownRecord' }

/** The code of a problem that says a value is taken, beside the refusal of what the state does not allow */
const ALREADY_EXISTS = '3002'

/** Registers a member of the staff in the ledger of a salon. */
const createStaffMember = async (
  salonId: string,
  request: ModelsStaffCreateRequest,
): Promise<StaffAnswer<StaffEntryAttempt>> => {
  const answer = await staffCrudCreate(salonId, request).catch(() => null)

  return (
    match(answer)
      .returnType<StaffAnswer<StaffEntryAttempt>>()
      .with({ status: 201 }, ({ data }) => ({
        type: 'written',
        member: data.data,
      }))
      .with({ status: 400 }, ({ data }) => ({
        type: 'invalid',
        values: refusedValuesOf(data),
      }))
      .with({ status: 409 }, () => CONFLICT)
      .with({ status: 403 }, () => FORBIDDEN)
      // The salon was read before the form opened: one removed since is a failure of the write
      .with({ status: P.union(404, 413, 415) }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/** Changes the properties of a member that the request names. */
const updateStaffMember = async (
  salonId: string,
  staffId: string,
  request: ModelsStaffUpdateRequest,
): Promise<StaffAnswer<StaffWriteAttempt>> => {
  const answer = await staffCrudUpdate(salonId, staffId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<StaffAnswer<StaffWriteAttempt>>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'written',
      member: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409, data: { code: ALREADY_EXISTS } }, () => CONFLICT)
    .with({ status: 409 }, () => OWN_RECORD)
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** The key the whole ledger of a salon is read under: among the lists, which a write drops. */
export const wholeLedgerKeyOf = (salonId: string): string[] => [
  ...STAFF_LISTS,
  salonId,
  'whole',
]

/** The members of a salon, read to the end: for the owner and an administrator, who keep the ledger. */
export const readWholeLedger = (
  salonId: string,
): Promise<
  { type: 'found'; items: ModelsStaffResponse[] } | Forbidden | Unread
> =>
  toTheEnd(async (cursor) => {
    const answer = await staffCrudList(salonId, {
      ...from(cursor),
      limit: LARGEST_PAGE,
    }).catch(() => null)

    return match(answer)
      .returnType<Page<ModelsStaffResponse> | Forbidden | Unread>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 403 }, () => FORBIDDEN)
      .with(P.union({ status: 400 }, { status: 404 }), () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  })

/**
 * Which value another member has, of a write the API refused as taken: the
 * one that was sent, when only one was; otherwise the address of mail if
 * another member of the ledger has it, and the staff code if not (a
 * removed member keeps theirs, and is in no list).
 */
const duplicateIn = async (
  salonId: string,
  { email, staffCode }: ModelsStaffUpdateRequest,
  self: string | undefined,
): Promise<
  Extract<StaffWriteAttempt, { type: 'duplicate' }> | Forbidden | Unread
> => {
  if (email === undefined) {
    return { type: 'duplicate', field: 'staffCode' }
  }
  if (staffCode === undefined || staffCode === null) {
    return { type: 'duplicate', field: 'email' }
  }
  const ledger = await readWholeLedger(salonId)
  if (ledger.type !== 'found') {
    return ledger
  }
  const taken = ledger.items.some(
    (member) => member.email === email.toLowerCase() && member.id !== self,
  )

  return { type: 'duplicate', field: taken ? 'email' : 'staffCode' }
}

/** Registers a member, and finds out which value another member has when the API refused it as taken. */
export const attemptStaffEntry = async (
  salonId: string,
  request: ModelsStaffCreateRequest,
): Promise<StaffEntryAttempt> => {
  const outcome = await createStaffMember(salonId, request)

  return outcome.type === 'conflict'
    ? duplicateIn(salonId, request, undefined)
    : outcome
}

/** Changes a member, and finds out which value another member has when the API refused it as taken. */
export const attemptStaffChange = async (
  salonId: string,
  staffId: string,
  request: ModelsStaffUpdateRequest,
): Promise<StaffWriteAttempt> => {
  const outcome = await updateStaffMember(salonId, staffId, request)

  return outcome.type === 'conflict'
    ? duplicateIn(salonId, request, staffId)
    : outcome
}

/** What came of the removal of a member. */
export type StaffRemoval =
  | { type: 'removed' }
  /** Bookings that are not finished name the member */
  | { type: 'busy' }
  | NotFound
  | Forbidden
  | Unread

/**
 * Removes a member from the ledger. The screens do not offer the removal
 * of the member the account is linked to, which the API refuses with the
 * same 409: a 409 is the bookings that name the member.
 */
export const removeStaffMember = async (
  salonId: string,
  staffId: string,
): Promise<StaffRemoval> => {
  const answer = await staffCrudDelete(salonId, staffId).catch(() => null)

  return match(answer)
    .returnType<StaffRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 409 }, () => ({ type: 'busy' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
    .exhaustive(outsideTheContract)
}
