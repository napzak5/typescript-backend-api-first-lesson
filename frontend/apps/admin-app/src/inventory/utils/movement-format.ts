import type {
  ModelsInventoryTransactionResponse,
  ModelsInventoryTransactionType,
  ModelsProductResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import type { NamedChoice } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminInventoryMessages,
  adminStaffMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { quantityNameOf } from './stock-format'

/*
 * The kinds of the movements of stock, and how a movement is named on the
 * screens.
 */

/** Which way a kind of movement moves the stock: in, out, or either, as the movement says */
export type MovementWay = 'in' | 'out' | 'either'

const { movements } = adminInventoryMessages

type MovementKind = {
  way: MovementWay
  /** The kind changes the stock without anything seen moving, or takes it off the books: it says why */
  needsReason: boolean
  /** Only those who keep the stock record it: the owner, a manager and an administrator */
  forKeepers: boolean
}

const KINDS: Record<ModelsInventoryTransactionType, MovementKind> = {
  purchase: { way: 'in', needsReason: false, forKeepers: false },
  use: { way: 'out', needsReason: false, forKeepers: false },
  sale: { way: 'out', needsReason: false, forKeepers: false },
  return: { way: 'either', needsReason: false, forKeepers: false },
  adjustment: { way: 'either', needsReason: true, forKeepers: true },
  disposal: { way: 'out', needsReason: true, forKeepers: true },
  transfer: { way: 'either', needsReason: false, forKeepers: true },
}

/** Every kind, in the order the form offers them: what is recorded every day first */
const ORDER: readonly ModelsInventoryTransactionType[] = [
  'purchase',
  'use',
  'sale',
  'return',
  'adjustment',
  'disposal',
  'transfer',
]

/** A kind of movement, by name: 「仕入れ」. */
export const movementTypeNameOf = (
  type: ModelsInventoryTransactionType,
): LocalizedText => movements.kinds[type]

/** Which way a kind moves the stock. */
export const wayOf = (type: ModelsInventoryTransactionType): MovementWay =>
  KINDS[type].way

/** Whether a kind of movement says why it was made. */
export const needsReason = (type: ModelsInventoryTransactionType): boolean =>
  KINDS[type].needsReason

/** The kinds an account records: every kind for those who keep the stock, those of every day for the others. */
export const recordedKindsOf = (
  keeps: boolean,
): ModelsInventoryTransactionType[] =>
  ORDER.filter((type) => keeps || !KINDS[type].forKeepers)

/** Every kind, to narrow the history to one */
export const MOVEMENT_TYPE_CHOICES: readonly NamedChoice[] = ORDER.map(
  (type) => ({ value: type, label: movements.kinds[type] }),
)

/** Whether a text is the name of a kind, as an address or a form holds it. */
export const movementTypeIn = (
  text: string,
): ModelsInventoryTransactionType | undefined =>
  ORDER.find((type) => type === text)

/** How a movement changed the stock, with its sign and the unit: 「+12 tube」, 「−2.5 tube」. */
export const changeNameOf = (
  quantity: number,
  product: Pick<ModelsProductResponse, 'unit'> | undefined,
): LocalizedText =>
  quantity < 0
    ? movements.decrease(quantityNameOf(-quantity, product))
    : movements.increase(quantityNameOf(quantity, product))

/**
 * Why a movement was made: what it says, or that it was the receipt of a
 * purchase order, which says nothing.
 */
export const movementReasonOf = ({
  reason,
  referenceType,
}: Pick<
  ModelsInventoryTransactionResponse,
  'reason' | 'referenceType'
>): LocalizedText | null =>
  movements.reasonOf(reason, referenceType === 'purchase_order')

/**
 * The member who recorded something, by the name the salon shows; a member
 * who left is not in the list.
 */
export const performerNameOf = (
  performedBy: string,
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[],
): LocalizedText => {
  const member = staff.find(({ id }) => id === performedBy)

  return member === undefined
    ? adminStaffMessages.unlisted
    : adminStaffMessages.named(member.displayName)
}
