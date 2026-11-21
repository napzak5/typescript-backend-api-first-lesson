import {
  FAILED,
  type Forbidden,
  from,
  outsideTheContract,
  type Page,
  pageOf,
  REFUSED_PARTS,
  refusedValuesOf,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsPointExpiringResponse,
  type ModelsPointTransactionResponse,
  pointCrudAdjust,
  pointCrudEarn,
  pointCrudGetBalance,
  pointCrudGetExpiring,
  pointCrudListTransactions,
  pointCrudUse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { readSale } from '../sales/sales-api'
import { customerKeyOf } from './customers-api'
import { type PointAttempt, type PointRecording, whyRefused } from './points'

const idSchema = z.uuid()

const REFUSED = P.union(...REFUSED_PARTS)

/** The same, for a request whose 400 names the values it refused */
const UNANSWERED = P.union(...UNANSWERED_PARTS)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The key of what is read of the points of a customer: below the customer, whose record holds the balance too. */
export const pointsKeyOf = (customerId: string): string[] => [
  ...customerKeyOf(customerId),
  'points',
]

/** The key of the balance of a customer. */
export const balanceKeyOf = (customerId: string): string[] => [
  ...pointsKeyOf(customerId),
  'balance',
]

/** The key of the points of a customer that expire soon. */
export const expiringKeyOf = (customerId: string): string[] => [
  ...pointsKeyOf(customerId),
  'expiring',
]

/** The key of the history of the points of a customer, the pages that were read. */
export const transactionsKeyOf = (customerId: string): string[] => [
  ...pointsKeyOf(customerId),
  'transactions',
]

export type BalanceRead = { type: 'found'; balance: number } | Unread

/**
 * The balance of a customer: what their latest transaction left. The
 * screen reads the customer first: an answer that says nothing of the
 * balance (no customer, no permission) is one that was not read.
 */
export const readBalance = async (customerId: string): Promise<BalanceRead> => {
  if (!idSchema.safeParse(customerId).success) {
    return FAILED
  }
  const answer = await pointCrudGetBalance(customerId).catch(() => null)

  return match(answer)
    .returnType<BalanceRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      balance: data.data.balance,
    }))
    .with({ status: P.union(403, 404) }, () => FAILED)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** How many days ahead the points that expire soon are counted over. */
export const EXPIRING_DAYS = 30

export type ExpiringRead =
  | { type: 'found'; expiring: ModelsPointExpiringResponse }
  | Unread

/**
 * The points given that expire within the days ahead and are not used:
 * those whose day is past too, which can be used until they are expired.
 * As the balance, they are read after the customer.
 */
export const readExpiring = async (
  customerId: string,
): Promise<ExpiringRead> => {
  if (!idSchema.safeParse(customerId).success) {
    return FAILED
  }
  const answer = await pointCrudGetExpiring(customerId, {
    days: EXPIRING_DAYS,
  }).catch(() => null)

  return match(answer)
    .returnType<ExpiringRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      expiring: data.data,
    }))
    .with({ status: P.union(403, 404) }, () => FAILED)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** How many transactions a page of the history has. */
const TRANSACTIONS_PAGE = 20

/**
 * The transactions of a customer, the latest first, a page at a time. The
 * screen reads the customer first: an answer that says nothing of the
 * transactions (no customer, no permission) is one that was not read.
 */
export const readTransactionsPage = async (
  customerId: string,
  cursor: string | undefined,
): Promise<Page<ModelsPointTransactionResponse> | Unread> => {
  const answer = await pointCrudListTransactions(customerId, {
    ...from(cursor),
    limit: TRANSACTIONS_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<Page<ModelsPointTransactionResponse> | Unread>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: P.union(403, 404) }, () => FAILED)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** Sends a recording to the operation of its kind. */
const send = (recording: PointRecording) =>
  match(recording)
    .with({ type: 'earn' }, ({ request }) => pointCrudEarn(request))
    .with({ type: 'use' }, ({ request }) => pointCrudUse(request))
    .with({ type: 'adjust' }, ({ request }) => pointCrudAdjust(request))
    .exhaustive()
    .catch(() => null)

/**
 * Records points, and finds out why the API refused them with a conflict,
 * which it does not say: the balance is read again, and the sale they were
 * for.
 */
export const recordPoints = async (
  recording: PointRecording,
): Promise<PointAttempt> => {
  const answer = await send(recording)
  const outcome = match(answer)
    .returnType<PointAttempt | { type: 'conflict' }>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'recorded',
      transaction: data.data,
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
  if (outcome.type !== 'conflict') {
    return outcome
  }
  const { customerId, referenceId } = recording.request
  const [balance, sale] = await Promise.all([
    readBalance(customerId),
    referenceId === null ? undefined : readSale(referenceId),
  ])

  return {
    type: 'refused',
    why: whyRefused(
      recording,
      balance.type === 'found' ? balance.balance : undefined,
      sale?.type === 'found' ? sale.sale : undefined,
    ),
  }
}
