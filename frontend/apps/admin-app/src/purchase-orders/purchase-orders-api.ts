import {
  FAILED,
  type Forbidden,
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  type RefusedValue,
  refusedValuesOf,
  toTheEnd,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsOrderStatusType,
  type ModelsPurchaseOrderCancelRequest,
  type ModelsPurchaseOrderCreateRequest,
  type ModelsPurchaseOrderReceiveRequest,
  type ModelsPurchaseOrderResponse,
  type ModelsPurchaseOrderUpdateRequest,
  type ModelsReorderSuggestionResponse,
  type PurchaseOrderCrudListParams,
  purchaseOrderCrudApprove,
  purchaseOrderCrudCancel,
  purchaseOrderCrudCreate,
  purchaseOrderCrudGet,
  purchaseOrderCrudList,
  purchaseOrderCrudListReorderSuggestions,
  purchaseOrderCrudReceive,
  purchaseOrderCrudUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'

/*
 * The purchase orders of a salon: what it asks its suppliers for, item by
 * item, at what price. Everybody who works at the salon reads them and
 * makes them, and an administrator. The routes are not below the salon:
 * the salon is a condition of the list, and an order names its salon
 * itself.
 */

const UNANSWERED = P.union(...UNANSWERED_PARTS)

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

const CONFLICT: { type: 'conflict' } = { type: 'conflict' }

/** What came of an operation on the status of an order. */
export type OrderStep =
  | { type: 'changed'; order: ModelsPurchaseOrderResponse }
  /** The order is no longer in a status the operation is for: it changed elsewhere */
  | { type: 'conflict' }
  | NotFound
  | Forbidden
  | Unread

type StepAnswer =
  | Awaited<ReturnType<typeof purchaseOrderCrudUpdate>>
  | Awaited<ReturnType<typeof purchaseOrderCrudApprove>>
  | Awaited<ReturnType<typeof purchaseOrderCrudCancel>>

/**
 * What an operation on the status answered. A refused body or ID says
 * nothing a person could act on: the screens send what the API takes.
 */
const orderStepOf = (answer: StepAnswer | null): OrderStep =>
  match(answer)
    .returnType<OrderStep>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'changed',
      order: data.data,
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(400, 413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)

/** Moves an order one status on: a draft to approval, an approved order to ordered, an ordered one to shipped. */
export const moveOrder = async (
  purchaseOrderId: string,
  status: ModelsOrderStatusType,
): Promise<OrderStep> =>
  orderStepOf(
    await purchaseOrderCrudUpdate(purchaseOrderId, { status }).catch(
      () => null,
    ),
  )

/** Approves an order that waits for it. */
export const approveOrder = async (
  purchaseOrderId: string,
): Promise<OrderStep> =>
  orderStepOf(await purchaseOrderCrudApprove(purchaseOrderId).catch(() => null))

/** Cancels an order that was not delivered, with the reason. */
export const cancelOrder = async (
  purchaseOrderId: string,
  request: ModelsPurchaseOrderCancelRequest,
): Promise<OrderStep> =>
  orderStepOf(
    await purchaseOrderCrudCancel(purchaseOrderId, request).catch(() => null),
  )

export type OrderUpdate =
  | { type: 'changed'; order: ModelsPurchaseOrderResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The order was delivered or cancelled meanwhile: it does not change any more */
  | { type: 'conflict' }
  | NotFound
  | Forbidden
  | Unread

/** Changes the day an order is to be delivered on and its notes. */
export const changeOrder = async (
  purchaseOrderId: string,
  request: ModelsPurchaseOrderUpdateRequest,
): Promise<OrderUpdate> => {
  const answer = await purchaseOrderCrudUpdate(purchaseOrderId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<OrderUpdate>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'changed',
      order: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type OrderReceipt =
  | { type: 'received'; order: ModelsPurchaseOrderResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The stock row of an item was removed meanwhile: nothing was received */
  | { type: 'rowsChanged' }
  /**
   * The order is no longer ordered or shipped, or the stock of a row
   * would go above what a row holds: nothing was received
   */
  | { type: 'conflict' }
  | NotFound
  | Forbidden
  | Unread

/** Puts the goods that came into the stock rows of the items of an order, and closes it as delivered. */
export const receiveOrder = async (
  purchaseOrderId: string,
  request: ModelsPurchaseOrderReceiveRequest,
): Promise<OrderReceipt> => {
  const answer = await purchaseOrderCrudReceive(purchaseOrderId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<OrderReceipt>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'received',
      order: data.data,
    }))
    .with({ status: 400 }, ({ data }) => {
      const values = refusedValuesOf(data)

      return values.some(isRemovedRow)
        ? { type: 'rowsChanged' }
        : { type: 'invalid', values }
    })
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * The key the reorder suggestions of a salon are read under: below its
 * orders, which every order that is made or moved on drops, as what is on
 * order changes with it.
 */
export const suggestionsKeyOf = (salonId: string): string[] => [
  ...purchaseOrdersKeyOf(salonId),
  'suggestions',
]

export type EverySuggestion =
  | { type: 'found'; items: ModelsReorderSuggestionResponse[] }
  /** The account reads no suggestions of the salon */
  | Forbidden
  | Unread

/**
 * Every product of a salon whose stock and what is on order come to its
 * reorder point or less, with how many to order, in the order of the
 * codes of the products.
 */
export const readEverySuggestion = (
  salonId: string,
): Promise<EverySuggestion> =>
  toTheEnd(async (cursor) => {
    const answer = await purchaseOrderCrudListReorderSuggestions({
      salonId,
      ...from(cursor),
      limit: LARGEST_PAGE,
    }).catch(() => null)

    // A 400 says that the salon was removed after it was read, or the
    // product of the cursor meanwhile
    return match(answer)
      .returnType<Page<ModelsReorderSuggestionResponse> | Forbidden | Unread>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 403 }, () => FORBIDDEN)
      .with({ status: 400 }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  })
