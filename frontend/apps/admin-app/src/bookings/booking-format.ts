import type {
  ModelsBookingResponse,
  ModelsBookingStatusType,
} from '@beauty-salon-frontend/api-client'
import { timeOfDayAt } from '@beauty-salon-frontend/salon-screens'
import type { BadgeProps } from '@beauty-salon-frontend/ui'

const STATUS_NAMES: Record<ModelsBookingStatusType, string> = {
  draft: '下書き',
  pending: '確定待ち',
  confirmed: '確定',
  in_progress: '施術中',
  completed: '完了',
  cancelled: 'キャンセル',
  no_show: '無断キャンセル',
}

/** The state of a booking, in the word the salon uses. */
export const statusNameOf = (status: ModelsBookingStatusType): string =>
  STATUS_NAMES[status]

const STATUS_TONES: Record<
  ModelsBookingStatusType,
  NonNullable<BadgeProps['tone']>
> = {
  draft: 'neutral',
  pending: 'warning',
  confirmed: 'success',
  in_progress: 'info',
  completed: 'neutral',
  cancelled: 'neutral',
  no_show: 'danger',
}

/** The group the state belongs to: the colour of its badge. */
export const statusToneOf = (
  status: ModelsBookingStatusType,
): NonNullable<BadgeProps['tone']> => STATUS_TONES[status]

/** From when until when, on the clock of the salon: 「10:00〜11:00」. */
export const hoursOf = (
  { startTime, endTime }: Pick<ModelsBookingResponse, 'startTime' | 'endTime'>,
  timezone: string,
): string =>
  `${timeOfDayAt(startTime, timezone)}〜${timeOfDayAt(endTime, timezone)}`

/** What is said of a customer who was removed. */
export const GONE_CUSTOMER = '削除された顧客'

/** What is said of a member of the staff the salon no longer shows. */
export const UNLISTED_STAFF = '一覧にないスタッフ'

/** What is said of a line that has no member: it takes nobody's time */
export const NO_MEMBER = '未定'

/** What is said of a service that was removed. */
export const GONE_SERVICE = '削除されたメニュー'
