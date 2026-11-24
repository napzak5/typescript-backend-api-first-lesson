import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import {
  ModelsStaffLevelType,
  type ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { type NamedChoice, NONE } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import type { TreatmentRemovalSays } from '../../treatments/utils/treatment-format'
import type { StaffRemoval } from '../api/staff-api'

const { removal, values } = adminStaffMessages

/*
 * How the screens of the staff ledger name what the ledger keeps of a
 * member of the staff: the level, the name, the pay, and whether the member
 * works and takes bookings.
 */

/** The levels, in the order of the contract: from the newest to the most experienced */
export const LEVELS: readonly ModelsStaffLevelType[] =
  Object.values(ModelsStaffLevelType)

const LEVEL_NAMES: Record<ModelsStaffLevelType, LocalizedText> =
  termMessages.staffLevel

/** What a level is called: 「スタイリスト」. */
export const levelNameOf = (level: ModelsStaffLevelType): LocalizedText =>
  LEVEL_NAMES[level]

/** The levels a form offers, in the order of the contract. */
export const LEVEL_CHOICES: readonly NamedChoice[] = LEVELS.map((level) => ({
  value: level,
  label: LEVEL_NAMES[level],
}))

/** The name of a member as the ledger keeps it, family name first: 「Tanaka Hiroshi」. */
export const staffNameOf = ({
  lastName,
  firstName,
}: Pick<ModelsStaffResponse, 'lastName' | 'firstName'>): string =>
  `${lastName} ${firstName}`

/** The name of a member with its kana, when there is one: 「Tanaka Hiroshi（タナカ ヒロシ）」. */
export const fullStaffNameOf = (
  member: Pick<
    ModelsStaffResponse,
    'lastName' | 'firstName' | 'lastNameKana' | 'firstNameKana'
  >,
): LocalizedText =>
  adminStaffMessages.fullName(
    staffNameOf(member),
    [member.lastNameKana, member.firstNameKana]
      .filter((part) => part !== null)
      .join(' '),
  )

/** How a member is called on the screens: by the name the customers see, 「Hiroshi Tanaka さん」 in Japanese. */
export const staffCalled = ({
  displayName,
}: Pick<ModelsStaffResponse, 'displayName'>): LocalizedText =>
  adminStaffMessages.called(displayName)

/** Whether a member works at the salon: an inactive member's account cannot use the screens of the salon */
export const activityNameOf = ({
  isActive,
}: Pick<ModelsStaffResponse, 'isActive'>): LocalizedText =>
  isActive ? values.active : values.inactive

/** Whether a member is offered to the customers who book */
export const bookingsNameOf = ({
  canReceiveBookings,
}: Pick<ModelsStaffResponse, 'canReceiveBookings'>): LocalizedText =>
  canReceiveBookings ? values.takesBookings : values.takesNoBookings

/** A share of the sales, as the ledger keeps it to two decimal places: 「12.5%」. */
export const commissionNameOf = (rate: number): LocalizedText =>
  formats.percentOf(rate, { most: 2 })

/** A time kept before or after each booking: 「15 分」, or none. */
export const bufferNameOf = (minutes: number): LocalizedText =>
  minutes === 0 ? NONE : formats.minutesOf(minutes)

/** How many bookings a member takes at a time: 「3 件まで」. */
export const concurrentBookingsNameOf = (count: number): LocalizedText =>
  values.concurrentBookingsOf(count)

/** The years of experience of a member: 「5 年」, or nothing when none were written. */
export const yearsNameOf = (years: number | null): LocalizedText | null =>
  years === null ? null : values.yearsOf(years)

/** The member of the staff the signed-in account is linked to: the API refuses to let it lock itself out */
export const isOwnStaffRecord = (
  member: Pick<ModelsStaffResponse, 'userId'>,
  userId: string | undefined,
): boolean => userId !== undefined && member.userId === userId

/** The roles that keep the staff ledger: the owner of a salon, and an administrator for every salon */
const KEEPERS: readonly string[] = ['owner', 'admin']

/** Whether an account of the role keeps the staff ledger, and is led to it from the header. */
export const mayKeepStaffLedger = (role: string): boolean =>
  KEEPERS.includes(role)

/**
 * What is said after a member was to be removed; the member is named by
 * the name the customers see. Bookings that are not finished keep the
 * member: they are finished, cancelled or removed, or given to another
 * member by a change of their time, first.
 */
export const afterStaffRemoval = (
  outcome: StaffRemoval,
  displayName: string,
): TreatmentRemovalSays =>
  match(outcome)
    .returnType<TreatmentRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: removal.done(displayName),
    }))
    .with({ type: 'busy' }, () => ({
      type: 'refused',
      message: removal.busy(displayName),
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    // The account no longer keeps the ledger of the salon
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: removal.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: removal.failed,
    }))
    .exhaustive()
