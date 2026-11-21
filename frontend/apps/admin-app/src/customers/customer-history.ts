import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerResponse,
  ModelsCustomerVersionOperationType,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import type {
  CustomerRemoval,
  CustomerRestoration,
  Removal,
} from './customer-history-api'

/** The roles that may take a customer out of the ledger, bring one back, merge two, and read the history */
const KEEPERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether an account of the role may take customers out of the ledger, bring them back, merge them and read their history. */
export const mayKeepCustomers = (role: string): boolean =>
  KEEPERS.includes(role)

/** What a member of the staff is told where the ledger would be kept. */
export const KEPT_BY_OTHERS =
  '台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。'

const OPERATION_NAMES: Record<ModelsCustomerVersionOperationType, string> = {
  baseline: '記録の開始',
  create: '登録',
  update: '更新',
  delete: '削除',
  restore: '復元',
  merge: '統合',
  erase: '消去',
}

/** What made a version, in a word: 「更新」. */
export const operationNameOf = (
  operation: ModelsCustomerVersionOperationType,
): string => OPERATION_NAMES[operation]

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
 * values the history began with were made by nobody.
 */
export const changerNameOf = (
  changedBy: string | null,
  { me, customer }: KnownAccounts,
): string =>
  match(changedBy)
    .with(null, () => '')
    .with(me, () => 'あなた')
    .when(
      (id) => id === customer,
      () => 'お客様ご本人',
    )
    .otherwise(() => 'ほかのアカウント')

/** Why a removed customer cannot come back, in a sentence; `undefined` when they can. */
export const whyUnrestorable = (removal: Removal): string | undefined =>
  match(removal)
    .returnType<string | undefined>()
    .with('deleted', () => undefined)
    .with('merged', () => 'ほかのお客様に統合されたため、台帳に戻せません。')
    .with('erased', () => '削除の依頼で消去されたため、台帳に戻せません。')
    .exhaustive()

/** What follows an attempt to take a customer out of the ledger. */
export type RemovalSays =
  /** The customer left the ledger: the page shows them as removed */
  | { type: 'done' }
  /** Nothing was done, and nothing is known to have changed: said in the dialog */
  | { type: 'again'; message: string }
  /** The customer stays, and will: the dialog closes, and the page says why */
  | { type: 'refused'; message: string }
  /** The customer had left already: the page shows them as removed */
  | { type: 'gone' }

export const afterRemoval = (outcome: CustomerRemoval): RemovalSays =>
  match(outcome)
    .returnType<RemovalSays>()
    .with({ type: 'removed' }, () => ({ type: 'done' }))
    .with({ type: 'unfinished' }, () => ({
      type: 'refused',
      message:
        '終わっていない予約があるため、削除できませんでした。予約を完了、キャンセル、または削除してから、もう一度お試しください。',
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: `このアカウントでは、お客様を台帳から削除できません。${KEPT_BY_OTHERS}`,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'お客様を台帳から削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()

/** What follows an attempt to bring a customer back to the ledger. */
export type RestorationSays =
  /** The customer is back: the page shows them as the ledger holds them now */
  | { type: 'done'; customer: ModelsCustomerResponse }
  /** The customer is not what the page shows any more: it is read again */
  | { type: 'changed' }
  /** Another customer has their address of mail: said, with the way to that customer */
  | { type: 'emailTaken'; message: string }
  /** Nothing was done: said on the page */
  | { type: 'refused'; message: string }

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
      message: `このお客様のメールアドレス（${email}）は、削除のあとに登録されたお客様が使っています。そのお客様のメールアドレスを変えてから、台帳に戻してください。`,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: `このアカウントでは、お客様を台帳に戻せません。${KEPT_BY_OTHERS}`,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'refused',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'refused',
      message:
        'お客様を台帳に戻せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
