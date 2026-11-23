import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerResponse,
  ModelsCustomerVersionOperationType,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match, P } from 'ts-pattern'
import type {
  CustomerRemoval,
  CustomerRestoration,
  Removal,
} from '../api/customer-history-api'

/** The roles that may take a customer out of the ledger, bring one back, merge two, and read the history */
const KEEPERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether an account of the role may take customers out of the ledger, bring them back, merge them and read their history. */
export const mayKeepCustomers = (role: string): boolean =>
  KEEPERS.includes(role)

const {
  history,
  removal: removalMessages,
  removed,
  restoration,
} = adminCustomerMessages

/** What a member of the staff is told where the ledger would be kept. */
export const KEPT_BY_OTHERS: LocalizedText =
  adminCustomerMessages.keeping.keptByOthers

const OPERATION_NAMES: Record<
  ModelsCustomerVersionOperationType,
  LocalizedText
> = history.operations

/** What made a version, in a word: 「更新」. */
export const operationNameOf = (
  operation: ModelsCustomerVersionOperationType,
): LocalizedText => OPERATION_NAMES[operation]

/** Whose accounts a screen can name. */
export type KnownAccounts = {
  /** The account that is signed in */
  me: string
  /** The account of the customer, when they have one */
  customer: string | null
}

/**
 * Who made a version, as far as the salon can tell: the API names an
 * account by its ID, and a salon cannot read the name of an account. The
 * values the history began with were made by nobody: `null`.
 */
export const changerNameOf = (
  changedBy: string | null,
  { me, customer }: KnownAccounts,
): LocalizedText | null =>
  match(changedBy)
    .returnType<LocalizedText | null>()
    .with(null, () => null)
    .with(me, () => history.changers.you)
    .when(
      (id) => id === customer,
      () => history.changers.customer,
    )
    .otherwise(() => history.changers.another)

/** Why a removed customer cannot come back, in a sentence; `undefined` when they can. */
export const whyUnrestorable = (removal: Removal): LocalizedText | undefined =>
  match(removal)
    .returnType<LocalizedText | undefined>()
    .with('deleted', () => undefined)
    .with('merged', () => removed.merged)
    .with('erased', () => removed.erased)
    .exhaustive()

/** What follows an attempt to take a customer out of the ledger. */
export type RemovalSays =
  /** The customer left the ledger: the page shows them as removed */
  | { type: 'done' }
  /** Nothing was done, and nothing is known to have changed: said in the dialog */
  | { type: 'again'; message: LocalizedText }
  /** The customer stays, and will: the dialog closes, and the page says why */
  | { type: 'refused'; message: LocalizedText }
  /** The customer had left already: the page shows them as removed */
  | { type: 'gone' }

export const afterRemoval = (outcome: CustomerRemoval): RemovalSays =>
  match(outcome)
    .returnType<RemovalSays>()
    .with({ type: 'removed' }, () => ({ type: 'done' }))
    .with({ type: 'unfinished' }, () => ({
      type: 'refused',
      message: removalMessages.unfinished,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: removalMessages.forbidden,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: removalMessages.failed,
    }))
    .exhaustive()

/** What follows an attempt to bring a customer back to the ledger. */
export type RestorationSays =
  /** The customer is back: the page shows them as the ledger holds them now */
  | { type: 'done'; customer: ModelsCustomerResponse }
  /** The customer is not what the page shows any more: it is read again */
  | { type: 'changed' }
  /** Another customer has their address of mail: said, with the way to that customer */
  | { type: 'emailTaken'; message: LocalizedText }
  /** Nothing was done: said on the page */
  | { type: 'refused'; message: LocalizedText }

export const afterRestoration = (
  outcome: CustomerRestoration,
  email: string,
): RestorationSays =>
  match(outcome)
    .returnType<RestorationSays>()
    .with({ type: 'restored' }, ({ customer }) => ({ type: 'done', customer }))
    .with({ type: P.union('unrestorable', 'notFound') }, () => ({
      type: 'changed',
    }))
    .with({ type: 'emailTaken' }, () => ({
      type: 'emailTaken',
      message: restoration.emailTaken(email),
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: restoration.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'refused',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'refused',
      message: restoration.failed,
    }))
    .exhaustive()
