import {
  customerCrudBatchGet,
  customerCrudCreate,
  customerCrudGet,
  customerCrudGetPreferences,
  customerCrudGetStatistics,
  customerCrudList,
  customerCrudUpdate,
  type ModelsCustomerCreateRequest,
  type ModelsCustomerPreferencesResponse,
  type ModelsCustomerResponse,
  type ModelsCustomerStatisticsResponse,
  type ModelsCustomerUpdateRequest,
  type ModelsStaffProfileResponse,
  staffProfileGet,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { outsideTheContract } from '../outside-the-contract'
import {
  FAILED,
  type Forbidden,
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  type Page,
  pageOf,
  refusedValuesOf,
  type Unread,
  unreadOf,
  whyUnread,
} from '../reading'
import type {
  CustomerEntryAttempt,
  CustomerWriteAttempt,
} from './customer-form'
import {
  type CustomerConditions,
  customerListParamsOf,
} from './customer-ledger'
import type { Period } from './customer-statistics'

export type CustomerRead =
  | { type: 'found'; customer: ModelsCustomerResponse }
  /** No customer has the ID, or the customer was removed */
  | NotFound
  | Unread

/**
 * Customers under their IDs. A customer who was removed is not among them:
 * what the screens show of one is that they are gone.
 */
export type CustomersRead =
  | { type: 'found'; customers: ReadonlyMap<string, ModelsCustomerResponse> }
  | Unread

const idSchema = z.uuid()

/** The answers of `Refused`, as a pattern */
const REFUSED = P.union(
  null,
  { status: 400 },
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

/**
 * Whatever the API answers that is neither the customer nor "not found":
 * 403 too, which an account that no salon reaches is given, and which the
 * screens of the salon have already said.
 */
const UNREAD = P.union(REFUSED, { status: 403 })

const unreadOfAnswer = (
  answer: { status: 403 } | Parameters<typeof unreadOf>[0],
): Unread => (answer?.status === 403 ? FAILED : unreadOf(answer))

export type CustomerPage = Page<ModelsCustomerResponse> | Unread

/** The key of a customer the screens read. */
export const customerKeyOf = (customerId: string): string[] => [
  'customers',
  customerId,
]

/**
 * The start of the keys of the lists of customers the screens read: the
 * ledger, the customers a booking is searched for, the customers of the
 * bookings of a day. A customer who is written may be in any of them.
 */
export const CUSTOMER_LISTS: readonly string[] = ['customers', 'lists']

/** The key of the preferences of a customer, and the staff they name. */
export const preferencesKeyOf = (customerId: string): string[] => [
  ...customerKeyOf(customerId),
  'preferences',
]

/** The key of what a customer did at a salon over a period. */
export const statisticsKeyOf = (
  customerId: string,
  salonId: string,
  { from: start, to: end }: Period,
): string[] => [...customerKeyOf(customerId), 'statistics', salonId, start, end]

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The same as `REFUSED`, for a request whose 400 names the values it refused */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

/** How many customers a page of a search has. */
const CUSTOMERS_PER_PAGE = 20

/**
 * The customers of the ledger of the platform whose names (with the
 * kana), address of mail or phone number have the keyword, a page at a
 * time. The ledger is one for every salon: a customer of another salon
 * comes to this one too.
 */
export const findCustomers = async (
  keyword: string,
  cursor: string | undefined,
): Promise<CustomerPage> => {
  const answer = await customerCrudList({
    search: keyword,
    ...from(cursor),
    limit: CUSTOMERS_PER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<CustomerPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with(UNREAD, unreadOfAnswer)
    .exhaustive(outsideTheContract)
}

/** How many customers a page of the ledger has. */
const LEDGER_PAGE = 20

/** The customers of the ledger that meet the conditions, a page at a time, the latest registered first. */
export const readCustomerPage = async (
  conditions: CustomerConditions,
  timezone: string,
  cursor: string | undefined,
): Promise<CustomerPage> => {
  const answer = await customerCrudList({
    ...customerListParamsOf(conditions, timezone),
    ...from(cursor),
    limit: LEDGER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<CustomerPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with(UNREAD, unreadOfAnswer)
    .exhaustive(outsideTheContract)
}

/** One customer. */
export const readCustomer = async (id: string): Promise<CustomerRead> => {
  if (!idSchema.safeParse(id).success) {
    return NOT_FOUND
  }
  const answer = await customerCrudGet(id).catch(() => null)

  return match(answer)
    .returnType<CustomerRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      customer: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with(UNREAD, unreadOfAnswer)
    .exhaustive(outsideTheContract)
}

/** The most customers one request reads */
const MOST_AT_ONCE = 100

const found = (
  customers: readonly ModelsCustomerResponse[],
): CustomersRead => ({
  type: 'found',
  customers: new Map(customers.map((customer) => [customer.id, customer])),
})

/** The customers one by one: those who were removed are left out. */
const readOneByOne = async (ids: readonly string[]): Promise<CustomersRead> => {
  const reads = await Promise.all(ids.map(readCustomer))
  const unread = reads.find(
    (read) => read.type === 'tooManyRequests' || read.type === 'failed',
  )
  if (unread?.type === 'tooManyRequests' || unread?.type === 'failed') {
    return unread
  }

  return found(
    reads.flatMap((read) => (read.type === 'found' ? [read.customer] : [])),
  )
}

/**
 * The customers of a list (no more than 100), in one request
 * (`POST /customers/batch/get`). The API refuses the whole request when one
 * of them was removed, and names that one only in a sentence: then every
 * customer is read on their own (`GET /customers/{id}`), and those who
 * were removed are left out.
 */
export const readCustomers = async (
  ids: readonly string[],
): Promise<CustomersRead> => {
  // The API takes each ID once
  const asked = [...new Set(ids)].slice(0, MOST_AT_ONCE)
  if (asked.length === 0) {
    return found([])
  }
  const answer = await customerCrudBatchGet({ ids: asked }).catch(() => null)

  return match(answer)
    .returnType<CustomersRead | Promise<CustomersRead>>()
    .with({ status: 200 }, ({ data }) => found(data.data))
    .with({ status: 404 }, () => readOneByOne(asked))
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNREAD, unreadOfAnswer)
    .exhaustive(outsideTheContract)
}

/** What a customer is called: 「山田 花子」. */
export const customerNameOf = ({
  lastName,
  firstName,
}: Pick<ModelsCustomerResponse, 'lastName' | 'firstName'>): string =>
  `${lastName} ${firstName}`

/** What a customer is called in kana, when they gave it: 「ヤマダ ハナコ」; nothing otherwise. */
export const customerKanaOf = ({
  lastNameKana,
  firstNameKana,
}: Pick<ModelsCustomerResponse, 'lastNameKana' | 'firstNameKana'>): string =>
  [lastNameKana, firstNameKana].filter((part) => part !== null).join(' ')

/** What came of a write of a customer, as the API answered it. */
type CustomerAnswer<Attempt extends CustomerWriteAttempt> =
  | Exclude<Attempt, { type: 'duplicate' }>
  /** Another customer has the address of mail or the referral code: the API says which in a sentence only */
  | { type: 'conflict' }

const CONFLICT: { type: 'conflict' } = { type: 'conflict' }

/** Registers a customer in the ledger. */
const createCustomer = async (
  request: ModelsCustomerCreateRequest,
): Promise<CustomerAnswer<CustomerEntryAttempt>> => {
  const answer = await customerCrudCreate(request).catch(() => null)

  return match(answer)
    .returnType<CustomerAnswer<CustomerEntryAttempt>>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'written',
      customer: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** Changes the properties of a customer that the request names. */
const updateCustomer = async (
  customerId: string,
  request: ModelsCustomerUpdateRequest,
): Promise<CustomerAnswer<CustomerWriteAttempt>> => {
  const answer = await customerCrudUpdate(customerId, request).catch(() => null)

  return match(answer)
    .returnType<CustomerAnswer<CustomerWriteAttempt>>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'written',
      customer: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * Whether another customer of the ledger has an address of mail: the
 * ledger is searched for it, and a customer whose address it is (in small
 * letters, as the API keeps them) is looked for among those found.
 */
const isEmailTaken = async (
  email: string,
  self: string | undefined,
): Promise<boolean | Unread> => {
  const answer = await customerCrudList({
    search: email,
    limit: LARGEST_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<boolean | Unread>()
    .with({ status: 200 }, ({ data }) =>
      data.data.some(
        (customer) =>
          customer.email === email.toLowerCase() && customer.id !== self,
      ),
    )
    .with(UNREAD, unreadOfAnswer)
    .exhaustive(outsideTheContract)
}

/**
 * Which value another customer has, of a write the API refused with a
 * conflict: the one that was sent, when only one was; otherwise the
 * address of mail if the ledger has it, and the referral code if not.
 */
const duplicateIn = async (
  { email, referralCode }: ModelsCustomerUpdateRequest,
  self: string | undefined,
): Promise<Extract<CustomerWriteAttempt, { type: 'duplicate' }> | Unread> => {
  if (email === undefined) {
    return { type: 'duplicate', field: 'referralCode' }
  }
  if (referralCode === undefined || referralCode === null) {
    return { type: 'duplicate', field: 'email' }
  }
  const taken = await isEmailTaken(email, self)
  if (typeof taken !== 'boolean') {
    return taken
  }

  return { type: 'duplicate', field: taken ? 'email' : 'referralCode' }
}

/** Registers a customer, and finds out which value another customer has when the API refused it with a conflict. */
export const attemptCustomerEntry = async (
  request: ModelsCustomerCreateRequest,
): Promise<CustomerEntryAttempt> => {
  const outcome = await createCustomer(request)

  return outcome.type === 'conflict' ? duplicateIn(request, undefined) : outcome
}

/** Changes a customer, and finds out which value another customer has when the API refused it with a conflict. */
export const attemptCustomerChange = async (
  customerId: string,
  request: ModelsCustomerUpdateRequest,
): Promise<CustomerWriteAttempt> => {
  const outcome = await updateCustomer(customerId, request)

  return outcome.type === 'conflict'
    ? duplicateIn(request, customerId)
    : outcome
}

/** The preferences of a customer, with the members of the staff they name whom a salon shows. */
export type PreferencesRead =
  | {
      type: 'found'
      preferences: ModelsCustomerPreferencesResponse
      /** The profiles of the members named, under their IDs; one who is not shown is not among them */
      staff: ReadonlyMap<string, ModelsStaffProfileResponse>
    }
  | NotFound
  | Unread

type StaffMemberRead =
  | { type: 'found'; profile: ModelsStaffProfileResponse }
  | NotFound
  | Unread

/**
 * A member of the staff, as their salon shows them. One who was removed,
 * or who does not work there at the moment, is not found.
 */
const readStaffMember = async (id: string): Promise<StaffMemberRead> => {
  const answer = await staffProfileGet(id).catch(() => null)

  return match(answer)
    .returnType<StaffMemberRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      profile: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with(
      P.union(null, { status: 400 }, { status: 429 }, { status: 500 }),
      unreadOf,
    )
    .exhaustive(outsideTheContract)
}

/**
 * The preferences of a customer (empty for one who set none), and the
 * profiles of the members of the staff they name. A member the API keeps
 * the ID of after they were removed has no profile: the screen does not
 * name them.
 */
export const readPreferences = async (
  customerId: string,
): Promise<PreferencesRead> => {
  const answer = await customerCrudGetPreferences(customerId).catch(() => null)
  const read = match(answer)
    .returnType<
      | { type: 'found'; preferences: ModelsCustomerPreferencesResponse }
      | NotFound
      | Unread
    >()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      preferences: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with(UNREAD, unreadOfAnswer)
    .exhaustive(outsideTheContract)
  if (read.type !== 'found') {
    return read
  }
  const { preferredStaffId, avoidStaffIds } = read.preferences
  const ids = [
    ...new Set([
      ...(preferredStaffId === null ? [] : [preferredStaffId]),
      ...avoidStaffIds,
    ]),
  ]
  const members = await Promise.all(ids.map(readStaffMember))
  if (
    members.some(
      (member) => member.type === 'tooManyRequests' || member.type === 'failed',
    )
  ) {
    return whyUnread(members)
  }

  return {
    type: 'found',
    preferences: read.preferences,
    staff: new Map(
      members.flatMap((member): [string, ModelsStaffProfileResponse][] =>
        member.type === 'found' ? [[member.profile.id, member.profile]] : [],
      ),
    ),
  }
}

export type StatisticsRead =
  | { type: 'found'; statistics: ModelsCustomerStatisticsResponse }
  /** The customer is not in the ledger */
  | NotFound
  /** The account is not one of the salon */
  | Forbidden
  | Unread

/** What a customer did at a salon over a period: the bookings and the sales of its days. */
export const readStatistics = async (
  customerId: string,
  salonId: string,
  { from: startDate, to: endDate }: Period,
): Promise<StatisticsRead> => {
  const answer = await customerCrudGetStatistics(customerId, {
    salonId,
    startDate,
    endDate,
  }).catch(() => null)

  return match(answer)
    .returnType<StatisticsRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      statistics: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}
