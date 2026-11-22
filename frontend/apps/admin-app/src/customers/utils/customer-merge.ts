import {
  type Forbidden,
  TOO_MANY_REQUESTS_MESSAGE,
  type Unread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerMergeConflictResolutionType,
  ModelsCustomerResponse,
  ModelsMedicalChartResponse,
} from '@beauty-salon-frontend/api-client'
import { same } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { customerNameOf } from '../api/customers-api'
import type { LedgerValues } from '../components/customer-record/ledger-items'
import { countNameOf } from './customer-format'
import { KEPT_BY_OTHERS } from './customer-history'

/*
 * Two records of one customer made one: the customer that is kept (the
 * primary), the one merged into it and removed (the secondary), and the
 * rules the API merges them by, so that what the merge makes is shown
 * before it is done.
 */

/** Whose value an item takes when both customers have one and they differ */
export type MergeWay = ModelsCustomerMergeConflictResolutionType

/** The ways, in the order they are offered */
export const MERGE_WAYS: readonly MergeWay[] = [
  'keep_primary',
  'keep_secondary',
  'keep_newest',
]

/** How a way is offered. */
export const mergeWayNameOf = (way: MergeWay): string =>
  match(way)
    .with('keep_primary', () => '残すお客様の値')
    .with('keep_secondary', () => 'まとめるお客様の値')
    .with('keep_newest', () => 'あとから台帳を直したほうの値')
    .exhaustive()

/** The value of a radio button that is a way; `undefined` for any other */
export const mergeWayIn = (value: string | null): MergeWay | undefined =>
  MERGE_WAYS.find((way) => way === value)

/**
 * Who a customer of a merge is: their name, and their address of mail,
 * which tells two records of one person apart: 「山田 花子 様（hanako@example.com）」.
 */
export const whoIs = ({
  lastName,
  firstName,
  email,
}: Pick<ModelsCustomerResponse, 'lastName' | 'firstName' | 'email'>): string =>
  `${customerNameOf({ lastName, firstName })} 様（${email}）`

/** The two customers of a merge: the one kept, and the one merged into it */
export type MergePair = {
  primary: ModelsCustomerResponse
  secondary: ModelsCustomerResponse
}

/**
 * Whose value a conflict takes, for a way: the newest is the customer
 * written last, as far as the API tells the time (to the millisecond),
 * and the primary when both were written at the same moment.
 */
const sideOf = (
  way: MergeWay,
  { primary, secondary }: MergePair,
): 'primary' | 'secondary' =>
  match(way)
    .returnType<'primary' | 'secondary'>()
    .with('keep_primary', () => 'primary')
    .with('keep_secondary', () => 'secondary')
    .with('keep_newest', () =>
      Date.parse(secondary.updatedAt) > Date.parse(primary.updatedAt)
        ? 'secondary'
        : 'primary',
    )
    .exhaustive()
/**
 * The value of one item after the merge: the value both have, the value of
 * the one that has a value, or else the value of `side`.
 */
const mergedValue = <T>(
  primary: T,
  secondary: T,
  side: 'primary' | 'secondary',
  isEmpty: (value: T) => boolean = (value) => value === null,
): T => {
  if (same(primary, secondary) || isEmpty(secondary)) {
    return primary
  }
  if (isEmpty(primary)) {
    return secondary
  }
  return side === 'primary' ? primary : secondary
}

/**
 * What the ledger keeps of the primary after the merge, as the API works it
 * out (`POST /customers/merge`): an item both have the same is kept, an
 * item one of them has is taken, and an item they have differently is that
 * of the way. A referrer who is one of the two is no value: the customer
 * would refer themselves.
 */
export const mergedLedgerOf = (
  pair: MergePair,
  way: MergeWay,
): LedgerValues => {
  const { primary, secondary } = pair
  const side = sideOf(way, pair)
  const of = <K extends keyof LedgerValues>(field: K): LedgerValues[K] =>
    mergedValue(primary[field], secondary[field], side)
  const referrerOf = ({ referredBy }: ModelsCustomerResponse): string | null =>
    referredBy === primary.id || referredBy === secondary.id ? null : referredBy

  return {
    firstName: of('firstName'),
    lastName: of('lastName'),
    firstNameKana: of('firstNameKana'),
    lastNameKana: of('lastNameKana'),
    email: of('email'),
    phoneNumber: of('phoneNumber'),
    alternativePhone: of('alternativePhone'),
    postalCode: of('postalCode'),
    prefecture: of('prefecture'),
    city: of('city'),
    address: of('address'),
    building: of('building'),
    birthDate: of('birthDate'),
    gender: of('gender'),
    occupation: of('occupation'),
    membershipTier: of('membershipTier'),
    preferences: of('preferences'),
    notes: of('notes'),
    internalNotes: of('internalNotes'),
    tags: mergedValue(
      primary.tags,
      secondary.tags,
      side,
      (tags) => tags.length === 0,
    ),
    referredBy: mergedValue(referrerOf(primary), referrerOf(secondary), side),
    referralCode: of('referralCode'),
    allowMarketing: of('allowMarketing'),
    allowSms: of('allowSms'),
    allowEmail: of('allowEmail'),
    isActive: of('isActive'),
    hairType: of('hairType'),
    hairThickness: of('hairThickness'),
    scalpCondition: of('scalpCondition'),
    customerStatus: of('customerStatus'),
  }
}

/** The largest balance of points a customer may have */
const LARGEST_BALANCE = 2_147_483_647

/** The most entries a list of a chart may have */
const MOST_LISTED = 50

/** A list of a chart that a merge puts together */
type ChartList = 'previousTreatments' | 'preferredProducts' | 'avoidProducts'

const CHART_LISTS: readonly ChartList[] = [
  'previousTreatments',
  'preferredProducts',
  'avoidProducts',
]

const CHART_LIST_NAMES: Record<ChartList, string> = {
  previousTreatments: '施術歴',
  preferredProducts: '使いたい製品',
  avoidProducts: '避けたい製品',
}

/** How many entries a list has once both are put together: those of one, then those of the other it does not have. */
const unitedCount = (
  primary: readonly unknown[],
  secondary: readonly unknown[],
): number =>
  primary.length +
  secondary.filter((entry) => !primary.some((kept) => same(kept, entry))).length

/** What a merge needs to know besides the customers, read for both of them */
export type MergeRecords = {
  /** Whether the customer asked for their data to be erased, and the request is pending */
  erasureAsked: { primary: boolean; secondary: boolean }
  /** The chart of the customer; `null` for one who has none */
  charts: {
    primary: ModelsMedicalChartResponse | null
    secondary: ModelsMedicalChartResponse | null
  }
}

/** Why two customers cannot be merged, which the API would refuse with 409 */
export type MergeObstacle =
  /** Both are the profiles of accounts, which cannot be made one */
  | { type: 'accounts' }
  /** The customer asked for their data to be erased: who they are */
  | { type: 'erasureAsked'; who: string }
  /** The points of both are more than a balance holds */
  | { type: 'points'; total: number }
  /** A list of both charts holds more than a chart does */
  | { type: 'chart'; list: ChartList }

/**
 * Why the API would refuse to merge the two, in the order it checks; none
 * when it would not. The API tells only the first, in a sentence: the
 * screen says them all before anything is sent.
 */
export const mergeObstaclesOf = (
  { primary, secondary }: MergePair,
  { erasureAsked, charts }: MergeRecords,
): MergeObstacle[] => {
  const accounts: MergeObstacle[] =
    primary.userId !== null && secondary.userId !== null
      ? [{ type: 'accounts' }]
      : []
  const asked = [
    ...(erasureAsked.primary ? [primary] : []),
    ...(erasureAsked.secondary ? [secondary] : []),
  ].map(
    (customer): MergeObstacle => ({
      type: 'erasureAsked',
      who: whoIs(customer),
    }),
  )
  const total = primary.loyaltyPoints + secondary.loyaltyPoints
  const points: MergeObstacle[] =
    total > LARGEST_BALANCE ? [{ type: 'points', total }] : []
  const { primary: kept, secondary: merged } = charts
  const chart =
    kept === null || merged === null
      ? []
      : CHART_LISTS.filter(
          (list) => unitedCount(kept[list], merged[list]) > MOST_LISTED,
        ).map((list): MergeObstacle => ({ type: 'chart', list }))

  return [...accounts, ...asked, ...points, ...chart]
}

/** Why two customers cannot be merged, in a sentence. */
export const obstacleTextOf = (obstacle: MergeObstacle): string =>
  match(obstacle)
    .with(
      { type: 'accounts' },
      () =>
        '2 人とも、ご自分のアカウントでサインインしているお客様です。アカウントは 1 つにまとめられないため、まとめられません。',
    )
    .with(
      { type: 'erasureAsked' },
      ({ who }) =>
        `${who}から、データの削除の依頼を受け付けています。依頼を取り消してから、まとめてください。`,
    )
    .with(
      { type: 'points' },
      ({ total }) =>
        `2 人のポイントを合わせると ${countNameOf(total, 'ポイント')}になり、1 人が持てる ${countNameOf(LARGEST_BALANCE, 'ポイント')}を超えます。`,
    )
    .with(
      { type: 'chart' },
      ({ list }) =>
        `2 人のカルテを合わせると、${CHART_LIST_NAMES[list]}が ${MOST_LISTED} 件を超えます。どちらかのカルテを短くしてから、まとめてください。`,
    )
    .exhaustive()

/** Which of the two the API no longer found */
export type MergeSide = 'primary' | 'secondary'

/** What came of an attempt to merge two customers */
export type MergeAttempt =
  /** The two are one: the primary as the ledger holds them now */
  | { type: 'merged'; customer: ModelsCustomerResponse }
  /** One of the two, or both, left the ledger in the meantime */
  | { type: 'gone'; sides: MergeSide[] }
  /** The API refused, for a reason it gave in a sentence: what was read is read again */
  | { type: 'refused' }
  | Forbidden
  | Unread

/** What follows an attempt to merge two customers */
export type MergeSays =
  /** The two are one: the page of the primary shows them */
  | { type: 'done'; customer: ModelsCustomerResponse; message: string }
  /** Nothing was done, and nothing is known to have changed: said in the dialog */
  | { type: 'again'; message: string }
  /** Nothing was done, and the two are read again: the dialog closes, and the page says why */
  | { type: 'refused'; message: string }

export const afterMerge = (
  outcome: MergeAttempt,
  pair: MergePair,
): MergeSays => {
  const primary = whoIs(pair.primary)
  const secondary = whoIs(pair.secondary)

  return match(outcome)
    .returnType<MergeSays>()
    .with({ type: 'merged' }, ({ customer }) => ({
      type: 'done',
      customer,
      message: `2 人のお客様を、${customerNameOf(pair.primary)} 様にまとめました。`,
    }))
    .with({ type: 'gone' }, ({ sides }) => ({
      type: 'refused',
      message: `${sides
        .map((side) => (side === 'primary' ? primary : secondary))
        .join(
          'と',
        )}は、もう台帳にいません。ほかの画面で、台帳から削除されたか、ほかのお客様にまとめられました。`,
    }))
    .with({ type: 'refused' }, () => ({
      type: 'refused',
      message:
        'その間に 2 人の記録が変わったため、まとめられませんでした。2 人の記録を読み直しました。',
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: `このアカウントでは、お客様をまとめられません。${KEPT_BY_OTHERS}`,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'お客様をまとめられませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
}
