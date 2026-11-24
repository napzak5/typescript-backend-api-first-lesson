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
import type { BadgeTone, NamedChoice } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminPurchaseOrderMessages,
  adminStaffMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { quantityNameOf } from '../../inventory/utils/stock-format'

const { doneBy, statuses, words } = adminPurchaseOrderMessages

/*
 * The statuses of the purchase orders, and how an order is named on the
 * screens.
 */

/** The colour that groups the statuses; the word says which one */
const TONES: Record<ModelsOrderStatusType, BadgeTone> = {
  draft: 'neutral',
  pending: 'warning',
  approved: 'info',
  ordered: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'neutral',
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
export const orderStatusNameOf = (
  status: ModelsOrderStatusType,
): LocalizedText => statuses[status]

/** The colour a status is shown in. */
export const orderStatusToneOf = (status: ModelsOrderStatusType): BadgeTone =>
  TONES[status]

/** Every status, to narrow the orders to one */
export const ORDER_STATUS_CHOICES: readonly NamedChoice[] = STATUS_ORDER.map(
  (status) => ({ value: status, label: statuses[status] }),
)

/** Whether a text is the name of a status, as an address or a form holds it. */
export const orderStatusIn = (
  text: string,
): ModelsOrderStatusType | undefined =>
  STATUS_ORDER.find((status) => status === text)

/** The day a moment is on at the salon, as a list names it: 「2026年11月21日（土）」. */
export const orderDayNameOf = (
  moment: string,
  timezone: string,
): LocalizedText => dayNameOf(dayAt(new Date(moment), timezone))

/** The day an order is to be delivered on at the salon: 「2026年11月28日（土）」, or 「未定」. */
export const deliveryDayNameOf = (
  expectedDelivery: string | null,
  timezone: string,
): LocalizedText =>
  expectedDelivery === null
    ? words.notSet
    : orderDayNameOf(expectedDelivery, timezone)

/** How much of what an item orders: 「10 tube」. */
export const itemQuantityNameOf = ({
  quantity,
  unit,
}: Pick<ModelsPurchaseOrderItem, 'quantity' | 'unit'>): LocalizedText =>
  quantityNameOf(quantity, { unit })

/**
 * When something was done to an order, on the clock of the salon, and who
 * did it: 「2026年11月21日（土） 10:00（佐藤 健）」. Nobody is named for an
 * administrator, nor while the staff are being read.
 */
export const doneNameOf = (
  moment: string,
  doneByWhom: string | null,
  timezone: string,
  staff:
    | readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
    | undefined,
): LocalizedText => {
  const when = momentNameAt(moment, timezone)
  if (doneByWhom === null || staff === undefined) {
    return when
  }

  return doneBy(
    when,
    staff.find(({ id }) => id === doneByWhom)?.displayName ??
      adminStaffMessages.unlisted,
  )
}
