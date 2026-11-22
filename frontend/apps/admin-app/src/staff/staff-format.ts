import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import {
  ModelsStaffLevelType,
  type ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { match } from 'ts-pattern'
import type { Option } from '../customers/customer-format'
import type { TreatmentRemovalSays } from '../treatments/treatment-format'
import type { StaffRemoval } from './staff-api'

/*
 * How the screens of the staff ledger name what the ledger keeps of a
 * member of the staff: the level, the name, the pay, and whether the member
 * works and takes bookings.
 */

/** The levels, in the order of the contract: from the newest to the most experienced */
export const LEVELS: readonly ModelsStaffLevelType[] =
  Object.values(ModelsStaffLevelType)

const LEVEL_NAMES: Record<ModelsStaffLevelType, string> = {
  junior: 'ジュニア',
  stylist: 'スタイリスト',
  senior: 'シニア',
  expert: 'エキスパート',
  director: 'ディレクター',
}

export const levelNameOf = (level: ModelsStaffLevelType): string =>
  LEVEL_NAMES[level]

export const LEVEL_OPTIONS: readonly Option[] = LEVELS.map((level) => ({
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
): string => {
  const kana = [member.lastNameKana, member.firstNameKana]
    .filter((part) => part !== null)
    .join(' ')

  return kana === '' ? staffNameOf(member) : `${staffNameOf(member)}（${kana}）`
}

/** How a member is called on the screens: by the name the customers see, 「Hiroshi Tanaka さん」. */
export const staffCalled = ({
  displayName,
}: Pick<ModelsStaffResponse, 'displayName'>): string => `${displayName} さん`

/** Whether a member works at the salon: an inactive member's account cannot use the screens of the salon */
export const activityNameOf = ({
  isActive,
}: Pick<ModelsStaffResponse, 'isActive'>): string =>
  isActive ? '有効' : '無効'

/** Whether a member is offered to the customers who book */
export const bookingsNameOf = ({
  canReceiveBookings,
}: Pick<ModelsStaffResponse, 'canReceiveBookings'>): string =>
  canReceiveBookings ? '受ける' : '受けない'

/** A share of the sales, as the ledger keeps it to two decimal places: 「12.5%」. */
export const commissionNameOf = (rate: number): string =>
  `${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 }).format(rate)}%`

/** A time kept before or after each booking: 「15 分」, or none. */
export const bufferNameOf = (minutes: number): string =>
  minutes === 0 ? 'なし' : `${minutes} 分`

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
 * What is said after a member was to be removed; the member is named as
 * `staffCalled` names them. Bookings that are not finished keep the member:
 * they are finished, cancelled or removed, or given to another member by a
 * change of their time, first.
 */
export const afterStaffRemoval = (
  outcome: StaffRemoval,
  name: string,
): TreatmentRemovalSays =>
  match(outcome)
    .returnType<TreatmentRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: `${name}を、スタッフ台帳から削除しました。`,
    }))
    .with({ type: 'busy' }, () => ({
      type: 'refused',
      message: `${name}は、終わっていない予約（下書き、確定待ち、確定、施術中）を担当しているため、削除できません。予約を完了するか、キャンセルするか、日時の変更で担当をほかのスタッフに替えてから、削除してください。`,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    // The account no longer keeps the ledger of the salon
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message:
        'このアカウントでは、このサロンのスタッフを削除できません。スタッフ台帳を扱えるのは、サロンのオーナーと管理者です。',
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'スタッフを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
