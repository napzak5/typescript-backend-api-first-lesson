import {
  customerCrudBatchGet,
  customerCrudGet,
  customerCrudList,
  type ModelsCustomerResponse,
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
