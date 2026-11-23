import type {
  ModelsOrderStatusType,
  ModelsPurchaseOrderItem,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  dayNameOf,
  momentNameAt,
} from '@beauty-salon-frontend/salon-screens'
import type { BadgeTone, ChoiceOption } from '@beauty-salon-frontend/ui'
import { inJapanese } from '@beauty-salon-frontend/ui'
import { UNLISTED_STAFF } from '../../bookings/utils/booking-format'
import { quantityNameOf } from '../../inventory/utils/stock-format'

/*
 * The statuses of the purchase orders, and how an order is named on the
 * screens.
 */

type Status = {
  name: string
  /** The colour groups the statuses; the word says which one */
  tone: BadgeTone
}

const STATUSES: Record<ModelsOrderStatusType, Status> = {
  draft: { name: '下書き', tone: 'neutral' },
  pending: { name: '承認待ち', tone: 'warning' },
  approved: { name: '承認済み', tone: 'info' },
  ordered: { name: '発注済み', tone: 'info' },
  shipped: { name: '出荷済み', tone: 'info' },
  delivered: { name: '納品済み', tone: 'success' },
  cancelled: { name: '取り消し', tone: 'neutral' },
}

/** Every status, in the order an order goes through them */
const STATUS_ORDER: readonly ModelsOrderStatusType[] = [
  'draft',
  'pending',
  'approved',
  'ordered',
  'shipped',
  'delivered',
  'cancelled',
]

/** A status, by name: 「承認待ち」. */
export const orderStatusNameOf = (status: ModelsOrderStatusType): string =>
  STATUSES[status].name

/** The colour a status is shown in. */
export const orderStatusToneOf = (status: ModelsOrderStatusType): BadgeTone =>
  STATUSES[status].tone

/** Every status, to narrow the orders to one */
export const ORDER_STATUS_OPTIONS: readonly ChoiceOption[] = STATUS_ORDER.map(
  (status) => ({ value: status, label: STATUSES[status].name }),
)

/** Whether a text is the name of a status, as an address or a form holds it. */
export const orderStatusIn = (
  text: string,
): ModelsOrderStatusType | undefined =>
  STATUS_ORDER.find((status) => status === text)

/** What is said of a delivery nobody set a day for */
const NO_DELIVERY_DAY = '未定'

/** The day a moment is on at the salon, as a list names it: 「2026年11月21日（土）」. */
export const orderDayNameOf = (moment: string, timezone: string): string =>
  inJapanese(dayNameOf(dayAt(new Date(moment), timezone)))

/** The day an order is to be delivered on at the salon: 「2026年11月28日（土）」, or 「未定」. */
export const deliveryDayNameOf = (
  expectedDelivery: string | null,
  timezone: string,
): string =>
  expectedDelivery === null
    ? NO_DELIVERY_DAY
    : orderDayNameOf(expectedDelivery, timezone)

/** How much of what an item orders: 「10 tube」. */
export const itemQuantityNameOf = ({
  quantity,
  unit,
}: Pick<ModelsPurchaseOrderItem, 'quantity' | 'unit'>): string =>
  inJapanese(quantityNameOf(quantity, { unit }))

/**
 * When something was done to an order, on the clock of the salon, and who
 * did it: 「2026年11月21日（土） 10:00（佐藤 健）」. Nobody is named for an
 * administrator, nor while the staff are being read.
 */
export const doneNameOf = (
  moment: string,
  doneBy: string | null,
  timezone: string,
  staff:
    | readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
    | undefined,
): string => {
  const who =
    doneBy === null || staff === undefined
      ? undefined
      : (staff.find(({ id }) => id === doneBy)?.displayName ?? UNLISTED_STAFF)

  return `${inJapanese(momentNameAt(moment, timezone))}${who === undefined ? '' : `（${who}）`}`
}
