import type {
  ModelsBookingStatusType,
  ModelsCustomerBookingResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import type { BadgeTone } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import {
  portalBookingMessages,
  portalSalonMessages,
} from '@beauty-salon-shared/i18n/messages/portal'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { weekdayOf } from '../../salons/utils/salon-format'
import { priceOf } from '../../salons/utils/salon-menu'

const { summary: words } = portalBookingMessages
const { menu } = portalSalonMessages

const STATUS_NAMES: Record<ModelsBookingStatusType, LocalizedText> = {
  ...termMessages.bookingStatus,
  // A customer is told of a booking they did not come to without blame
  no_show: termMessages.notVisited,
}

/** The state of a booking, in the word a customer reads. */
export const statusNameOf = (status: ModelsBookingStatusType): LocalizedText =>
  STATUS_NAMES[status]

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

const STATUS_NOTES: Record<ModelsBookingStatusType, LocalizedText | undefined> =
  {
    draft: words.draftNote,
    pending: words.pendingNote,
    confirmed: undefined,
    in_progress: undefined,
    completed: undefined,
    cancelled: undefined,
    no_show: undefined,
  }

/** What comes next, for a state whose word does not say it. */
export const statusNoteOf = (
  status: ModelsBookingStatusType,
): LocalizedText | undefined => STATUS_NOTES[status]

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
): { day: LocalizedText; hours: LocalizedText } => ({
  day: weekdayOf(startTime, timezone),
  hours: formats.timeRangeAt(startTime, endTime, timezone),
})

/**
 * When a booking is, where its salon may be gone: as `whenOf` says it, or
 * the day alone (「2026年11月24日火曜日」). Without the time zone of the
 * salon, no time of day can be told, and the day is the calendar date at
 * the salon that the booking names, read without a time zone.
 */
export const whenKnownOf = (
  booking: Pick<
    ModelsCustomerBookingResponse,
    'bookingDate' | 'startTime' | 'endTime'
  >,
  timezone: string | null,
): { day: LocalizedText; hours: LocalizedText | null } =>
  timezone === null
    ? { day: formats.fullDayOf(booking.bookingDate), hours: null }
    : whenOf(booking, timezone)

/** The same in one line, for a sentence: 「2026年11月24日火曜日 10:30〜11:30」. */
export const whenLineOf = (
  booking: Pick<
    ModelsCustomerBookingResponse,
    'bookingDate' | 'startTime' | 'endTime'
  >,
  timezone: string | null,
): LocalizedText => {
  const { day, hours } = whenKnownOf(booking, timezone)

  return hours === null ? day : words.whenLine(day, hours)
}

/** The price of a service in one line: 「￥5,500（税込）」, 「￥8,000〜（税別）」, 「要相談」. */
export const priceLineOf = (
  service: Pick<
    ModelsServiceResponse,
    'price' | 'discountPrice' | 'pricingStrategy' | 'taxIncluded'
  >,
  currency: string,
): LocalizedText => {
  const price = priceOf(service, currency)

  return price.type === 'onConsultation'
    ? menu.onConsultation
    : menu.priceLine(
        price.orMore ? menu.orMore(price.amount) : price.amount,
        price.tax,
      )
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
): LocalizedText =>
  taxAmount > 0
    ? words.totalWithTax(
        formats.amountOf(totalAmount, currency),
        formats.amountOf(taxAmount, currency),
      )
    : formats.amountOf(totalAmount, currency)
