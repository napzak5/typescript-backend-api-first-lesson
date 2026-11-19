import {
  type ModelsPaymentMethodResponse,
  type ModelsPaymentRefundRequest,
  type ModelsPaymentResponse,
  type ModelsProblemDetails,
  type ModelsSaleCalculateRequest,
  type ModelsSaleCalculateResponse,
  type ModelsSaleCreateRequest,
  type ModelsSaleProcessRequest,
  type ModelsSaleReceiptResponse,
  type ModelsSaleResponse,
  type ModelsSaleUpdateRequest,
  type ModelsSaleVoidRequest,
  paymentCrudRefund,
  paymentMethodCrudList,
  saleCrudCalculate,
  saleCrudCreate,
  saleCrudGet,
  saleCrudGetReceipt,
  saleCrudList,
  saleCrudProcess,
  saleCrudUpdate,
  saleCrudVoidSale,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { outsideTheContract } from '../outside-the-contract'
import {
  FAILED,
  type Forbidden,
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  type Page,
  pageOf,
  toTheEnd,
  type Unread,
  unreadOf,
} from '../reading'
import { type CheckoutAttempt, saleOfBooking } from './checkout'
import type { PaymentAttempt } from './payments'
import type { RefundAttempt } from './refunds'
import type { SaleChangeAttempt, VoidAttempt } from './sale-changes'
import type { LedgerConditions } from './sales-ledger'

/** A value the API refused, with the rule it broke. */
export type RefusedValue = { field: string; rule: string }

export type SalePage = Page<ModelsSaleResponse> | Forbidden | Unread

export type SaleRead =
  | { type: 'found'; sale: ModelsSaleResponse }
  /** No sale has the ID, or it is one of another salon */
  | NotFound
  | Forbidden
  | Unread

/** The sales of a booking, those that were voided as well. */
export type SalesOfBooking =
  | { type: 'found'; sales: ModelsSaleResponse[] }
  | Forbidden
  | Unread

/** What a bill would come to, before it is entered. */
export type Calculation =
  | { type: 'calculated'; calculation: ModelsSaleCalculateResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  | Forbidden
  | Unread

/** What came of entering a sale. */
export type SaleCreation =
  | { type: 'created'; sale: ModelsSaleResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /**
   * The booking has a sale that is not void, or the time zone of the salon
   * is no name. The API says which in a sentence only
   */
  | { type: 'conflict' }
  | Forbidden
  | Unread

/** What came of recording a payment of a sale. */
export type PaymentRecording =
  | { type: 'recorded'; payment: ModelsPaymentResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The sale was voided, or has a refund, or has nothing left to pay */
  | { type: 'conflict' }
  | NotFound
  | Forbidden
  | Unread

/**
 * What came of changing a sale, of voiding it, and of giving a payment of
 * it back: the sale, or the payment, as it is now.
 */
type SaleWrite<Written> =
  | Written
  | { type: 'invalid'; values: RefusedValue[] }
  /**
   * A change: the sale was voided, or the time zone of the salon is no
   * name. A voiding: the sale was voided, or has a payment that was not
   * given back. A refund: the payment was not one that was received, or
   * was given back already. The API says which in a sentence only
   */
  | { type: 'conflict' }
  | NotFound
  | Forbidden
  | Unread

export type SaleUpdate = SaleWrite<{
  type: 'updated'
  sale: ModelsSaleResponse
}>

export type SaleVoiding = SaleWrite<{
  type: 'voided'
  sale: ModelsSaleResponse
}>

export type PaymentRefund = SaleWrite<{
  type: 'refunded'
  payment: ModelsPaymentResponse
}>

export type ReceiptRead =
  | { type: 'found'; receipt: ModelsSaleReceiptResponse }
  /** The sale was voided, or what was received does not come to its total */
  | { type: 'conflict' }
  | NotFound
  | Forbidden
  | Unread

export type PaymentMethodsRead =
  | { type: 'found'; items: ModelsPaymentMethodResponse[] }
  /** The salon was removed */
  | NotFound
  | Forbidden
  | Unread

const FORBIDDEN: Forbidden = { type: 'forbidden' }

const CONFLICT: { type: 'conflict' } = { type: 'conflict' }

/** The answers that say nothing about what was asked for, as a pattern */
const REFUSED = P.union(
  null,
  { status: 400 },
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

/** The same, for a request whose 400 names the values it refused */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const refusedValuesOf = ({
  errors,
}: Pick<ModelsProblemDetails, 'errors'>): RefusedValue[] =>
  (errors ?? []).map(({ field, rule }) => ({ field, rule }))

/** How many sales a page of the ledger has. */
const SALES_PER_PAGE = 50

/** The keys of what the screens read of the sales of a salon. */
export const saleListsKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'sales',
  'lists',
]

export const saleKeyOf = (saleId: string): string[] => ['sales', saleId]

/** The key of the sales of a booking: below the booking, which shows them. */
export const salesOfBookingKeyOf = (bookingId: string): string[] => [
  'bookings',
  bookingId,
  'sales',
]

export const paymentMethodsKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'payment-methods',
]

/**
 * The sales of a salon whose day is in a range, a page at a time, the
 * latest first. A member of the staff of another salon is refused.
 */
export const readSales = async (
  salonId: string,
  { from: startDate, to: endDate, paymentStatus }: LedgerConditions,
  cursor: string | undefined,
): Promise<SalePage> => {
  const answer = await saleCrudList({
    salonId,
    startDate,
    endDate,
    ...(paymentStatus === undefined ? {} : { paymentStatus }),
    ...from(cursor),
    limit: SALES_PER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<SalePage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 403 }, () => FORBIDDEN)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** The sales of a booking, read to the end: a booking has one that is not void at most. */
export const readSalesOfBooking = async (
  salonId: string,
  bookingId: string,
): Promise<SalesOfBooking> => {
  const read = await toTheEnd(async (cursor) => {
    const answer = await saleCrudList({
      salonId,
      bookingId,
      ...from(cursor),
      limit: LARGEST_PAGE,
    }).catch(() => null)

    return match(answer)
      .returnType<SalePage>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 403 }, () => FORBIDDEN)
      .with(REFUSED, unreadOf)
      .exhaustive(outsideTheContract)
  })

  return read.type === 'found' ? { type: 'found', sales: read.items } : read
}

const idSchema = z.uuid()

/**
 * A sale of an address. What is no ID is not asked for: the API would
 * answer that it takes no such value, which is no more than "not found".
 */
export const readSale = async (id: string): Promise<SaleRead> => {
  if (!idSchema.safeParse(id).success) {
    return NOT_FOUND
  }
  const answer = await saleCrudGet(id).catch(() => null)

  return match(answer)
    .returnType<SaleRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', sale: data.data }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * What the lines of a booking and the services added to them come to, at
 * the tax rate of the salon, and the kinds of payment that take the total
 * at once. Nothing is written.
 */
export const calculateSale = async (
  request: ModelsSaleCalculateRequest,
): Promise<Calculation> => {
  const answer = await saleCrudCalculate(request).catch(() => null)

  return match(answer)
    .returnType<Calculation>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'calculated',
      calculation: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** Enters a sale into the ledger of its salon. */
export const createSale = async (
  request: ModelsSaleCreateRequest,
): Promise<SaleCreation> => {
  const answer = await saleCrudCreate(request).catch(() => null)

  return match(answer)
    .returnType<SaleCreation>()
    .with({ status: 201 }, ({ data }) => ({ type: 'created', sale: data.data }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** Records a payment that was received for a sale. */
export const recordPayment = async (
  saleId: string,
  request: ModelsSaleProcessRequest,
): Promise<PaymentRecording> => {
  const answer = await saleCrudProcess(saleId, request).catch(() => null)

  return match(answer)
    .returnType<PaymentRecording>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'recorded',
      payment: data.data,
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

/** Changes the properties of a sale that the request names. */
export const updateSale = async (
  saleId: string,
  request: ModelsSaleUpdateRequest,
): Promise<SaleUpdate> => {
  const answer = await saleCrudUpdate(saleId, request).catch(() => null)

  return match(answer)
    .returnType<SaleUpdate>()
    .with({ status: 200 }, ({ data }) => ({ type: 'updated', sale: data.data }))
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

/** Voids a sale: it stays in the ledger, and says when and why. */
export const voidSale = async (
  saleId: string,
  request: ModelsSaleVoidRequest,
): Promise<SaleVoiding> => {
  const answer = await saleCrudVoidSale(saleId, request).catch(() => null)

  return match(answer)
    .returnType<SaleVoiding>()
    .with({ status: 200 }, ({ data }) => ({ type: 'voided', sale: data.data }))
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

/** Records that a payment was given back, whole or in part. */
export const refundPayment = async (
  paymentId: string,
  request: ModelsPaymentRefundRequest,
): Promise<PaymentRefund> => {
  const answer = await paymentCrudRefund(paymentId, request).catch(() => null)

  return match(answer)
    .returnType<PaymentRefund>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'refunded',
      payment: data.data,
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

/** The receipt of a sale, made anew every time it is asked for. */
export const readReceipt = async (saleId: string): Promise<ReceiptRead> => {
  if (!idSchema.safeParse(saleId).success) {
    return NOT_FOUND
  }
  const answer = await saleCrudGetReceipt(saleId).catch(() => null)

  return match(answer)
    .returnType<ReceiptRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      receipt: data.data,
    }))
    .with({ status: 409 }, () => CONFLICT)
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * The payment methods of a salon, read to the end: those it uses no more
 * as well, since a payment keeps the method it was received by.
 */
export const readPaymentMethods = async (
  salonId: string,
): Promise<PaymentMethodsRead> =>
  toTheEnd(async (cursor) => {
    const answer = await paymentMethodCrudList(salonId, {
      ...from(cursor),
      limit: LARGEST_PAGE,
    }).catch(() => null)

    return match(answer)
      .returnType<
        Page<ModelsPaymentMethodResponse> | NotFound | Forbidden | Unread
      >()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 404 }, () => NOT_FOUND)
      .with({ status: 403 }, () => FORBIDDEN)
      .with(REFUSED, unreadOf)
      .exhaustive(outsideTheContract)
  })

/**
 * Enters a sale, and finds out why the API refused it with a conflict,
 * which it says in a sentence only: the booking has a sale that is not
 * void (the one shown), or else the time zone of the salon is no name.
 */
export const attemptSale = async (
  request: ModelsSaleCreateRequest,
): Promise<CheckoutAttempt> => {
  const outcome = await createSale(request)
  if (outcome.type !== 'conflict') {
    return outcome
  }
  const { bookingId } = request
  if (bookingId === null) {
    return { type: 'unbillable' }
  }
  const now = await readSalesOfBooking(request.salonId, bookingId)
  if (now.type !== 'found') {
    return now
  }
  const billed = saleOfBooking(now.sales)

  return billed === undefined
    ? { type: 'unbillable' }
    : { type: 'billed', sale: billed }
}

/**
 * Records a payment, and finds out why the API refused it with a
 * conflict: the sale is read again, and shows why it takes no payment.
 */
export const attemptPayment = async (
  saleId: string,
  request: ModelsSaleProcessRequest,
): Promise<PaymentAttempt> => {
  const outcome = await recordPayment(saleId, request)
  if (outcome.type === 'recorded') {
    return { type: 'recorded' }
  }
  if (outcome.type !== 'conflict') {
    return outcome
  }
  const now = await readSale(saleId)

  return now.type === 'found' ? { type: 'refused', sale: now.sale } : now
}

export type ReceiptAttempt =
  | { type: 'found'; receipt: ModelsSaleReceiptResponse }
  /** The sale as it is now, which has no receipt */
  | { type: 'unissued'; sale: ModelsSaleResponse }
  | NotFound
  | Forbidden
  | Unread

/**
 * The receipt of a sale, and why there is none when the API refused it
 * with a conflict: the sale is read again, and shows why.
 */
export const attemptReceipt = async (
  saleId: string,
): Promise<ReceiptAttempt> => {
  const outcome = await readReceipt(saleId)
  if (outcome.type !== 'conflict') {
    return outcome
  }
  const now = await readSale(saleId)

  return now.type === 'found' ? { type: 'unissued', sale: now.sale } : now
}

/**
 * Changes a sale, and finds out why the API refused it with a conflict:
 * the sale is read again. One that was voided meanwhile is shown as it is
 * now; one that was not was refused for the time zone of its salon, which
 * gives the time that was sent no day.
 */
export const attemptSaleChange = async (
  saleId: string,
  request: ModelsSaleUpdateRequest,
): Promise<SaleChangeAttempt> => {
  const outcome = await updateSale(saleId, request)
  if (outcome.type !== 'conflict') {
    return outcome
  }
  const now = await readSale(saleId)
  if (now.type !== 'found') {
    return now
  }

  return now.sale.isVoid
    ? { type: 'refused', sale: now.sale }
    : { type: 'undated' }
}

/**
 * Voids a sale, and finds out why the API refused it with a conflict: the
 * sale is read again, and shows why it is not voided.
 */
export const attemptVoid = async (
  saleId: string,
  request: ModelsSaleVoidRequest,
): Promise<VoidAttempt> => {
  const outcome = await voidSale(saleId, request)
  if (outcome.type !== 'conflict') {
    return outcome
  }
  const now = await readSale(saleId)

  return now.type === 'found' ? { type: 'refused', sale: now.sale } : now
}

/**
 * Gives a payment of a sale back, and finds out why the API refused it with
 * a conflict: the sale is read again, and shows what became of the payment.
 */
export const attemptRefund = async (
  saleId: string,
  paymentId: string,
  request: ModelsPaymentRefundRequest,
): Promise<RefundAttempt> => {
  const outcome = await refundPayment(paymentId, request)
  if (outcome.type === 'refunded') {
    return { type: 'refunded' }
  }
  if (outcome.type !== 'conflict') {
    return outcome
  }
  const now = await readSale(saleId)

  return now.type === 'found' ? { type: 'refused', sale: now.sale } : now
}
