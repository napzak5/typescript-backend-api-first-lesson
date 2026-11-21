import type {
  ModelsInventoryTransactionResponse,
  ModelsInventoryTransactionType,
  ModelsProductResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import type { ChoiceOption } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { UNLISTED_STAFF } from '../bookings/booking-format'
import { NOT_RECORDED } from '../staff/staff-format'
import { quantityNameOf } from './stock-format'

/*
 * The kinds of the movements of stock, and how a movement is named on the
 * screens.
 */

/** Which way a kind of movement moves the stock: in, out, or either, as the movement says */
export type MovementWay = 'in' | 'out' | 'either'

type MovementKind = {
  name: string
  way: MovementWay
  /** The kind changes the stock without anything seen moving, or takes it off the books: it says why */
  needsReason: boolean
  /** Only those who keep the stock record it: the owner, a manager and an administrator */
  forKeepers: boolean
}

const KINDS: Record<ModelsInventoryTransactionType, MovementKind> = {
  purchase: {
    name: '仕入れ',
    way: 'in',
    needsReason: false,
    forKeepers: false,
  },
  use: {
    name: '施術で使用',
    way: 'out',
    needsReason: false,
    forKeepers: false,
  },
  sale: { name: '店頭販売', way: 'out', needsReason: false, forKeepers: false },
  return: {
    name: '返品',
    way: 'either',
    needsReason: false,
    forKeepers: false,
  },
  adjustment: {
    name: '在庫の調整',
    way: 'either',
    needsReason: true,
    forKeepers: true,
  },
  disposal: { name: '廃棄', way: 'out', needsReason: true, forKeepers: true },
  transfer: {
    name: 'サロン間の移動',
    way: 'either',
    needsReason: false,
    forKeepers: true,
  },
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
): string => KINDS[type].name

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
export const MOVEMENT_TYPE_OPTIONS: readonly ChoiceOption[] = ORDER.map(
  (type) => ({ value: type, label: KINDS[type].name }),
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
): string =>
  quantity < 0
    ? `−${quantityNameOf(-quantity, product)}`
    : `+${quantityNameOf(quantity, product)}`

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
>): string =>
  reason ??
  match(referenceType)
    .with('purchase_order', () => '発注の入荷')
    .otherwise(() => NOT_RECORDED)

/**
 * Who recorded a movement, by the name the salon shows: nobody is named
 * for an administrator, nor for the movement that began the records of a
 * row; a member who left is not in the list.
 */
export const performerNameOf = (
  performedBy: string | null,
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[],
): string =>
  performedBy === null
    ? NOT_RECORDED
    : (staff.find(({ id }) => id === performedBy)?.displayName ??
      UNLISTED_STAFF)
