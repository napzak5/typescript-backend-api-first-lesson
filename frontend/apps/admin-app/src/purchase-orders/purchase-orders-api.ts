import {
  type ModelsPurchaseOrderCreateRequest,
  type ModelsPurchaseOrderResponse,
  type PurchaseOrderCrudListParams,
  purchaseOrderCrudCreate,
  purchaseOrderCrudGet,
  purchaseOrderCrudList,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { outsideTheContract } from '../outside-the-contract'
import {
  FAILED,
  type Forbidden,
  from,
  NOT_FOUND,
  type NotFound,
  type Page,
  pageOf,
  type RefusedValue,
  refusedValuesOf,
  type Unread,
  unreadOf,
} from '../reading'

/*
 * The purchase orders of a salon: what it asks its suppliers for, item by
 * item, at what price. Everybody who works at the salon reads them and
 * makes them, and an administrator. The routes are not below the salon:
 * the salon is a condition of the list, and an order names its salon
 * itself.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/**
 * The key the purchase orders of a salon are read under. The pages of
 * every search are read below it, so that dropping it drops them all.
 */
export const purchaseOrdersKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'purchaseOrders',
]

/** The key a purchase order is read under. */
export const purchaseOrderKeyOf = (purchaseOrderId: string): string[] => [
  'purchaseOrder',
  purchaseOrderId.toLowerCase(),
]

const ORDER_PAGE = 20

/** What the list is asked for besides its page: the salon, and the conditions of the search */
export type OrderListParams = Omit<
  PurchaseOrderCrudListParams,
  'cursor' | 'limit'
>

export type OrderPage =
  | Page<ModelsPurchaseOrderResponse>
  /** The account reads no orders of the salon */
  | Forbidden
  | Unread

/** A page of the orders that meet the conditions, the latest ordered first. */
export const readOrderPage = async (
  params: OrderListParams,
  cursor: string | undefined,
): Promise<OrderPage> => {
  const answer = await purchaseOrderCrudList({
    ...params,
    ...from(cursor),
    limit: ORDER_PAGE,
  }).catch(() => null)

  // A 400 says that the salon was removed after it was read: the screens
  // send only what the API takes
  return match(answer)
    .returnType<OrderPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type OrderRead =
  | { type: 'found'; order: ModelsPurchaseOrderResponse }
  | NotFound
  /** The role of the account reads no orders */
  | Forbidden
  | Unread

/** A purchase order: one of a salon the account does not reach, or none, is not found. */
export const readOrder = async (
  purchaseOrderId: string,
): Promise<OrderRead> => {
  const answer = await purchaseOrderCrudGet(purchaseOrderId).catch(() => null)

  return match(answer)
    .returnType<OrderRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', order: data.data }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** Whether the API refused a stock row of an item because it is no row of the salon: one removed meanwhile */
const isRemovedRow = ({ field, rule }: RefusedValue): boolean =>
  /^items\.\d+\.inventoryId$/.test(field) && rule === 'not_found'

export type OrderEntry =
  | { type: 'made'; order: ModelsPurchaseOrderResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** A stock row of an item was removed meanwhile: nothing was made */
  | { type: 'rowsChanged' }
  | Forbidden
  | Unread

/** Makes a draft of an order of the stock rows of a salon. */
export const makeOrder = async (
  request: ModelsPurchaseOrderCreateRequest,
): Promise<OrderEntry> => {
  const answer = await purchaseOrderCrudCreate(request).catch(() => null)

  return match(answer)
    .returnType<OrderEntry>()
    .with({ status: 201 }, ({ data }) => ({ type: 'made', order: data.data }))
    .with({ status: 400 }, ({ data }) => {
      const values = refusedValuesOf(data)

      return values.some(isRemovedRow)
        ? { type: 'rowsChanged' }
        : // The salon was removed after it was read: nothing a person could correct
          values.some(({ field }) => field === 'salonId')
          ? FAILED
          : { type: 'invalid', values }
    })
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
