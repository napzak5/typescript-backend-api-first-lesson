import type {
  ModelsBookingResponse,
  ModelsSaleBreakdownResponse,
  ModelsSaleCalculateResponse,
  ModelsSaleCreateRequest,
  ModelsSaleResponse,
  ModelsSalesDetail,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import type { RefusedValue } from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'
import { textOf } from '../bookings/booking-actions'
import { nullIfBlank } from '../bookings/booking-entry'
import { GONE_SERVICE } from '../bookings/booking-format'

/*
 * Entering the sale of a booking: what it bills, how the tax that the API
 * calculated is put on its lines, what is sent, and what is said about the
 * answer.
 */

/**
 * Why a booking takes no checkout, in a sentence of its state; `undefined`
 * when the visit took place, and it does.
 */
export const whyNoCheckout = ({
  status,
}: Pick<ModelsBookingResponse, 'status'>): string | undefined =>
  match(status)
    .returnType<string | undefined>()
    // The visit took place: it is billed
    .with(P.union('in_progress', 'completed'), () => undefined)
    .with(
      P.union('cancelled', 'no_show'),
      () => 'キャンセルした予約には、会計を入れません。',
    )
    .with(
      P.union('draft', 'pending', 'confirmed'),
      () => '会計は、施術を始めると入れられます。',
    )
    .exhaustive()

/** The sale of a booking that is not void: a booking is billed once. */
export const saleOfBooking = (
  sales: readonly ModelsSaleResponse[],
): ModelsSaleResponse | undefined => sales.find(({ isVoid }) => !isVoid)

/** A line of a bill: a line of the booking, or a service added at the counter. */
export type BillLine = {
  /** `null` for a service that was removed from the menu */
  serviceId: string | null
  name: string
  unitPrice: number
  discountAmount: number
  taxIncluded: boolean
  staffId: string | null
}

/**
 * The lines a booking is billed for: its own lines at the amounts it took
 * when it was booked, in their order, then the services added at the
 * counter at the prices of the menu now, done by the member of the
 * booking. These are the lines the API calculates the bill from.
 */
export const billLinesOf = (
  booking: Pick<ModelsBookingResponse, 'services' | 'staffId'>,
  added: readonly string[],
  services: readonly ModelsServiceResponse[],
): BillLine[] => [
  ...booking.services
    .toSorted((one, other) => one.sortOrder - other.sortOrder)
    .map((line): BillLine => {
      const service = services.find(({ id }) => id === line.serviceId)

      return {
        serviceId: service === undefined ? null : service.id,
        name: service?.name ?? GONE_SERVICE,
        unitPrice: line.price,
        discountAmount: line.discountAmount,
        taxIncluded: line.taxIncluded,
        staffId: line.staffId,
      }
    }),
  ...added.flatMap((id): BillLine[] => {
    const service = services.find((one) => one.id === id)

    return service === undefined
      ? []
      : [
          {
            serviceId: service.id,
            name: service.name,
            unitPrice: service.price,
            discountAmount:
              service.price - (service.discountPrice ?? service.price),
            taxIncluded: service.taxIncluded,
            staffId: booking.staffId,
          },
        ]
  }),
]

/** What a line costs before the tax: its price less its discount. */
const netOf = ({ unitPrice, discountAmount }: BillLine): number =>
  unitPrice - discountAmount

/**
 * The tax of each line. The API adds the tax once to the sum of the lines
 * whose price does not include it; a sale keeps the tax of each line. So
 * the tax is shared among those lines by what they cost, a yen's fraction
 * dropped, and the yen that are left go one each to the first lines that
 * cost something. The shares come to the tax of the bill.
 */
export const taxSharesOf = (
  lines: readonly BillLine[],
  taxAmount: number,
): number[] => {
  const taxed = lines.map((line) => (line.taxIncluded ? 0 : netOf(line)))
  const base = taxed.reduce((sum, net) => sum + net, 0)
  if (base === 0) {
    return lines.map(() => 0)
  }
  const shares = taxed.map((net) => Math.floor((taxAmount * net) / base))
  const left = taxAmount - shares.reduce((sum, share) => sum + share, 0)
  const receivers = taxed.flatMap((net, index) => (net > 0 ? [index] : []))

  return shares.map((share, index) => {
    const rank = receivers.indexOf(index)

    return rank !== -1 && rank < left ? share + 1 : share
  })
}

/** The details of the sale: a line each, the tax shared among them. */
export const saleDetailsOf = (
  lines: readonly BillLine[],
  taxAmount: number,
): ModelsSalesDetail[] => {
  const shares = taxSharesOf(lines, taxAmount)

  return lines.map((line, index) => {
    const tax = shares[index] ?? 0

    return {
      itemType: 'service',
      itemId: line.serviceId,
      itemName: line.name,
      quantity: 1,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount,
      taxAmount: tax,
      totalAmount: netOf(line) + tax,
      staffId: line.staffId,
      commissionRate: null,
      commissionAmount: null,
      notes: null,
      sortOrder: index,
    }
  })
}

/** The amounts of a bill, as the screen has them. */
export type Bill =
  | { type: 'calculating' }
  | { type: 'calculated'; calculation: ModelsSaleCalculateResponse }
  /** The API would not calculate it, or calculated other prices: why, in a sentence */
  | { type: 'uncalculated'; message: string }
  /** The calculation could not be asked for: why, in a sentence */
  | { type: 'unread'; message: string }

/**
 * Whether the bill the screen shows is the one the API calculated: the
 * same prices and discounts. They differ when a price of the menu changed
 * after the menu was read; the tax would then not be that of the lines.
 */
export const agreesWith = (
  lines: readonly BillLine[],
  { subtotal, discountAmount }: ModelsSaleBreakdownResponse,
): boolean =>
  lines.reduce((sum, { unitPrice }) => sum + unitPrice, 0) === subtotal &&
  lines.reduce((sum, line) => sum + line.discountAmount, 0) === discountAmount

/** The place of an added service a refusal names: `services.2` is the third. */
const ADDED_AT = /^services\.(\d+)$/

/**
 * Why the API did not calculate the bill, in a sentence: a service that
 * was added was removed from the menu meanwhile, the booking was removed,
 * or the bill is more than a sale takes.
 */
export const whyNotCalculated = (
  values: readonly RefusedValue[],
  added: readonly string[],
  services: readonly Pick<ModelsServiceResponse, 'id' | 'name'>[],
): string => {
  const gone = values.flatMap(({ field }) => {
    const place = ADDED_AT.exec(field)?.[1]
    const id = place === undefined ? undefined : added[Number(place)]
    const name = services.find((one) => one.id === id)?.name

    return name === undefined ? [] : [name]
  })
  if (gone.length > 0) {
    return `${[...new Set(gone)].join('、')}は、メニューから削除されていました。外してください。`
  }
  if (values.some(({ field }) => field === 'bookingId')) {
    return 'この予約は、削除されていました。'
  }
  if (values.some(({ rule }) => rule === 'too_big')) {
    return '金額の合計が、1 件の売上で扱える上限を超えます。足した施術を減らしてください。'
  }

  return '金額を計算できませんでした。'
}

/** Nobody is recorded as the member of the staff who took the payment */
export const NO_CASHIER = 'none'

/** What the form of the checkout holds beside the lines. */
export type CheckoutValues = { staffId: string | null; notes: string | null }

/** The member of the staff who took the payment, and the note, from the form. */
export const readCheckout = (values: FormData): CheckoutValues => {
  const staffId = textOf(values, 'staffId')

  return {
    staffId: staffId === NO_CASHIER || staffId === '' ? null : staffId,
    notes: nullIfBlank(textOf(values, 'notes')),
  }
}

/**
 * The sale of a booking: for its customer, at the moment it is sent. The
 * points are left to the ledger of the points, which records them.
 */
export const saleRequestOf = (
  booking: Pick<ModelsBookingResponse, 'id' | 'salonId' | 'customerId'>,
  { staffId, notes }: CheckoutValues,
  details: ModelsSalesDetail[],
  now: Date,
): ModelsSaleCreateRequest => ({
  salonId: booking.salonId,
  customerId: booking.customerId,
  staffId,
  bookingId: booking.id,
  saleTime: now.toISOString(),
  pointsUsed: null,
  pointsEarned: null,
  notes,
  details,
})

/** What came of an attempt to enter a sale, after the API was asked why it refused. */
export type CheckoutAttempt =
  | { type: 'created'; sale: ModelsSaleResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The booking was billed meanwhile, by this sale */
  | { type: 'billed'; sale: ModelsSaleResponse }
  /** The booking has no sale: the time zone of the salon is no name */
  | { type: 'unbillable' }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What the screen does after an attempt. */
export type CheckoutSays =
  | { type: 'done'; sale: ModelsSaleResponse }
  | { type: 'billed'; sale: ModelsSaleResponse }
  | { type: 'again'; message: string; errors: Record<string, string> }

const TRY_AGAIN =
  '会計を入れられませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What is said of a value the API refused. */
const refusalMessageOf = ({ field, rule }: RefusedValue): string =>
  match([field, rule])
    .with(
      ['staffId', 'not_found'],
      () => 'このスタッフは、もう選べません。選び直してください。',
    )
    .with(
      ['customerId', P._],
      () =>
        'この予約のお客様は、台帳から削除されていたため、会計を入れられませんでした。',
    )
    .with(
      ['bookingId', P._],
      () =>
        'この予約は、会計を入れられる予約ではなくなっていました。予約を確かめてください。',
    )
    .when(
      ([refused, broken]) =>
        refused.startsWith('details.') && broken === 'not_found',
      () =>
        'メニューか担当のスタッフが、その間に削除されていたため、会計を入れられませんでした。予約の内容から開き直してください。',
    )
    .with(
      ['details', 'too_big'],
      () =>
        '金額の合計が、1 件の売上で扱える上限を超えます。足した施術を減らしてください。',
    )
    .otherwise(() => TRY_AGAIN)

/** What the screen says and does after an attempt to enter a sale. */
export const afterCheckout = (outcome: CheckoutAttempt): CheckoutSays =>
  match(outcome)
    .returnType<CheckoutSays>()
    .with({ type: 'created' }, ({ sale }) => ({ type: 'done', sale }))
    .with({ type: 'billed' }, ({ sale }) => ({ type: 'billed', sale }))
    .with({ type: 'invalid' }, ({ values }) => {
      const [first] = values
      const atStaff = values.find(({ field }) => field === 'staffId')

      return atStaff === undefined
        ? {
            type: 'again',
            message: first === undefined ? TRY_AGAIN : refusalMessageOf(first),
            errors: {},
          }
        : {
            type: 'again',
            message: '入力した内容を確かめて、もう一度お試しください。',
            errors: { staffId: refusalMessageOf(atStaff) },
          }
    })
    .with({ type: 'unbillable' }, () => ({
      type: 'again',
      message:
        'サロンのタイムゾーンが正しくないため、会計日を決められず、会計を入れられませんでした。サロンの設定を直してください。',
      errors: {},
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message:
        'このサロンの会計は、入れられません。会計を入れられるのは、そのサロンのスタッフと、管理者です。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: TRY_AGAIN,
      errors: {},
    }))
    .exhaustive()
