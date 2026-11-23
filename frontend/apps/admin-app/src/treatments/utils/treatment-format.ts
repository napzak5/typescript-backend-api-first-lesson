import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
  ModelsCustomerResponse,
  ModelsProductResponse,
  ModelsTreatmentMaterial,
  ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
import { type ChoiceOption, inJapanese } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { customerNameOf } from '../../customers/api/customers-api'
import { quantityOf } from '../../products/utils/quantity'
import type { TreatmentRemoval } from '../api/treatments-api'

/*
 * How a treatment record is said: its satisfaction, its time, its
 * materials and the products they are of.
 */

const SATISFACTIONS: readonly (readonly [number, string])[] = [
  [5, 'とても満足'],
  [4, '満足'],
  [3, 'ふつう'],
  [2, '不満'],
  [1, 'とても不満'],
]

/** How satisfied the customer was: 「5（とても満足）」. */
export const satisfactionNameOf = (satisfaction: number): string => {
  const name = SATISFACTIONS.find(([value]) => value === satisfaction)?.[1]

  return name === undefined
    ? String(satisfaction)
    : `${satisfaction}（${name}）`
}

/** The satisfactions a form offers, the highest first */
export const SATISFACTION_OPTIONS: readonly ChoiceOption[] = SATISFACTIONS.map(
  ([value]) => ({ value: String(value), label: satisfactionNameOf(value) }),
)

/** What is said of a satisfaction the customer did not give */
export const NOT_ANSWERED = '未回答'

/** How long a treatment took: 「75 分」. */
export const minutesNameOf = (minutes: number): string => `${minutes} 分`

/** How much of a product was used: 「0.5 bottle」. */
export const quantityNameOf = ({
  quantity,
  unit,
}: Pick<ModelsTreatmentMaterial, 'quantity' | 'unit'>): string =>
  `${inJapanese(quantityOf(quantity))} ${unit}`

/** A product as the screens name it: 「Developer 6% 1000ml（DEVELOPER001）」. */
export const productNameOf = ({
  name,
  productCode,
}: Pick<ModelsProductResponse, 'name' | 'productCode'>): string =>
  `${name}（${productCode}）`

/** What a product of a record that the salon no longer has is called */
export const REMOVED_PRODUCT = '削除された商品'

/** Who may remove a treatment record: a member of the staff changes it instead */
const REMOVERS: readonly string[] = ['owner', 'manager', 'admin']

export const mayRemoveTreatments = (role: string): boolean =>
  REMOVERS.includes(role)

/** Who removes a record, as an account that may not is told */
const REMOVED_BY_OTHERS =
  '間違えて書いた施術記録の削除は、オーナーとマネージャーができます。'

/** Whether the record was changed after it was written */
export const wasChanged = ({
  createdAt,
  updatedAt,
}: Pick<ModelsTreatmentRecordResponse, 'createdAt' | 'updatedAt'>): boolean =>
  createdAt !== updatedAt

/** A customer as a record names them: 「山田 花子 様」, or that they left the ledger. */
export const customerCalled = (
  customer: Pick<ModelsCustomerResponse, 'lastName' | 'firstName'> | undefined,
): string =>
  customer === undefined
    ? '台帳から削除されたお客様'
    : `${customerNameOf(customer)} 様`

/**
 * What a removal comes to on the screen. An area whose texts are messages
 * says messages (`TreatmentRemovalSays<LocalizedText>`).
 */
export type TreatmentRemovalSays<Text = string> =
  /** The record was removed: said in a notification on the list */
  | { type: 'done'; message: Text }
  /** Nothing was removed, and another attempt may: said in the dialog */
  | { type: 'again'; message: Text }
  /** What another attempt does not change: said above the record */
  | { type: 'refused'; message: Text }
  /** The record was removed meanwhile: the screen says it is not found */
  | { type: 'gone' }

/** What is said after a record was to be removed; the customer is named as `customerCalled` names them. */
export const afterTreatmentRemoval = (
  outcome: TreatmentRemoval,
  name: string,
): TreatmentRemovalSays =>
  match(outcome)
    .returnType<TreatmentRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: `${name}の施術記録を削除しました。`,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    // The role of the account changed meanwhile
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: `このアカウントでは、施術記録を削除できません。${REMOVED_BY_OTHERS}`,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: inJapanese(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '施術記録を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()

/** Whether a record can be written of a booking: once its treatment began. */
export const isTreated = ({
  status,
}: Pick<ModelsBookingResponse, 'status'>): boolean =>
  status === 'in_progress' || status === 'completed'
