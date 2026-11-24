import type {
  ModelsBookingResponse,
  ModelsBookingStatusType,
} from '@beauty-salon-frontend/api-client'
import type { BadgeTone } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'

const STATUS_NAMES: Record<ModelsBookingStatusType, LocalizedText> =
  termMessages.bookingStatus

/** The state of a booking, in the word the salon uses. */
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

/** From when until when, on the clock of the salon: 「10:00〜11:00」. */
export const hoursOf = (
  { startTime, endTime }: Pick<ModelsBookingResponse, 'startTime' | 'endTime'>,
  timezone: string,
): LocalizedText => formats.timeRangeAt(startTime, endTime, timezone)
