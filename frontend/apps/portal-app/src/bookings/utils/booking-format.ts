import type {
  ModelsBookingStatusType,
  ModelsCustomerBookingResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { type BadgeTone, inJapanese } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  amountOf,
  timeOfDayAt,
  weekdayOf,
} from '../../salons/utils/salon-format'
import { priceOf } from '../../salons/utils/salon-menu'

const STATUS_NAMES: Record<ModelsBookingStatusType, LocalizedText> = {
  ...termMessages.bookingStatus,
  // A customer is told of a booking they did not come to without blame
  no_show: termMessages.notVisited,
}

/** The state of a booking, in the word a customer reads. */
export const statusNameOf = (status: ModelsBookingStatusType): string =>
  inJapanese(STATUS_NAMES[status])

const STATUS_TONES: Record<ModelsBookingStatusType, BadgeTone> = {
  draft: 'neutral',
  pending: 'warning',
  confirmed: 'success',
  in_progress: 'info',
  completed: 'neutral',
  cancelled: 'neutral',
  no_show: 'danger',
}

/** The group the state belongs to: the colour of its badge. */
export const statusToneOf = (status: ModelsBookingStatusType): BadgeTone =>
  STATUS_TONES[status]

const STATUS_NOTES: Record<ModelsBookingStatusType, string | undefined> = {
  draft: 'サロンが、予約の内容を整えています。',
  pending: 'サロンが内容を確認すると、予約が確定します。',
  confirmed: undefined,
  in_progress: undefined,
  completed: undefined,
  cancelled: undefined,
  no_show: undefined,
}

/** What comes next, for a state whose word does not say it. */
export const statusNoteOf = (
  status: ModelsBookingStatusType,
): string | undefined => STATUS_NOTES[status]

/**
 * When a booking is, at the salon: its day (「2026年11月20日金曜日」) and
 * from when until when (「10:00〜11:00」). They are two values because a
 * narrow screen breaks the line between them, and nowhere else.
 */
export const whenOf = (
  {
    startTime,
    endTime,
  }: Pick<ModelsCustomerBookingResponse, 'startTime' | 'endTime'>,
  timezone: string,
): { day: string; hours: string } => ({
  day: weekdayOf(startTime, timezone),
  hours: `${timeOfDayAt(startTime, timezone)}〜${timeOfDayAt(endTime, timezone)}`,
})

/**
 * The day of a visit as the booking names it: 「2026年11月24日火曜日」. It
 * is a calendar date at the salon, and is read without a time zone.
 */
export const visitDayOf = (bookingDate: string): string =>
  inJapanese(formats.fullDayOf(bookingDate))

/**
 * When a booking is, where its salon may be gone: as `whenOf` says it, or
 * the day alone. Without the time zone of the salon, no time of day can be
 * told.
 */
export const whenKnownOf = (
  booking: Pick<
    ModelsCustomerBookingResponse,
    'bookingDate' | 'startTime' | 'endTime'
  >,
  timezone: string | null,
): { day: string; hours: string | null } =>
  timezone === null
    ? { day: visitDayOf(booking.bookingDate), hours: null }
    : whenOf(booking, timezone)

/** The same in one line, for a sentence: 「2026年11月24日火曜日 10:30〜11:30」. */
export const whenLineOf = (
  booking: Pick<
    ModelsCustomerBookingResponse,
    'bookingDate' | 'startTime' | 'endTime'
  >,
  timezone: string | null,
): string => {
  const { day, hours } = whenKnownOf(booking, timezone)

  return hours === null ? day : `${day} ${hours}`
}

/** The price of a service in one line: 「￥5,500（税込）」, 「￥8,000〜（税別）」, 「要相談」. */
export const priceLineOf = (
  service: Pick<
    ModelsServiceResponse,
    'price' | 'discountPrice' | 'pricingStrategy' | 'taxIncluded'
  >,
  currency: string,
): string => {
  const price = priceOf(service, currency)

  return price.type === 'onConsultation'
    ? '要相談'
    : `${price.amount}${price.orMore ? '〜' : ''}（${price.tax}）`
}

/**
 * What a booking comes to. The tax the API names is the tax that was added
 * to prices without it; a price that includes its tax has none to name.
 */
export const totalOf = (
  {
    totalAmount,
    taxAmount,
  }: Pick<ModelsCustomerBookingResponse, 'totalAmount' | 'taxAmount'>,
  currency: string,
): string =>
  taxAmount > 0
    ? `${amountOf(totalAmount, currency)}（うち消費税 ${amountOf(taxAmount, currency)}）`
    : amountOf(totalAmount, currency)
