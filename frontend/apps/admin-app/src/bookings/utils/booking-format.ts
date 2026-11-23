import type {
  ModelsBookingResponse,
  ModelsBookingStatusType,
} from '@beauty-salon-frontend/api-client'
import { timeOfDayAt } from '@beauty-salon-frontend/salon-screens'
import { type BadgeTone, inJapanese } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'

const STATUS_NAMES: Record<ModelsBookingStatusType, LocalizedText> =
  termMessages.bookingStatus

/** The state of a booking, in the word the salon uses. */
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

/** From when until when, on the clock of the salon: 「10:00〜11:00」. */
export const hoursOf = (
  { startTime, endTime }: Pick<ModelsBookingResponse, 'startTime' | 'endTime'>,
  timezone: string,
): string =>
  `${inJapanese(timeOfDayAt(startTime, timezone))}〜${inJapanese(timeOfDayAt(endTime, timezone))}`

/** What is said of a customer who was removed. */
export const GONE_CUSTOMER = '削除された顧客'

/** What is said of a member of the staff the salon no longer shows. */
export const UNLISTED_STAFF = '一覧にないスタッフ'

/** What is said of a line that has no member: it takes nobody's time */
export const NO_MEMBER = '未定'

/** What is said of a service that was removed. */
export const GONE_SERVICE = '削除されたメニュー'
