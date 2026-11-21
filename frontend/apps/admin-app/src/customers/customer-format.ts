import {
  ModelsCustomerGenderType,
  type ModelsCustomerResponse,
  ModelsCustomerStatusType,
  ModelsHairThicknessType,
  ModelsHairType,
  ModelsMembershipTierType,
  ModelsScalpConditionType,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'
import { categoryNameOf } from '@beauty-salon-frontend/salon-screens'
import type { BadgeTone } from '@beauty-salon-frontend/ui'

/*
 * How the screens of the ledger of the customers name what it holds: the
 * values of its enums, and what a few properties come to together.
 */

/** A choice of a select or of a group of checkboxes. */
export type Option = { value: string; label: string }

const TIER_NAMES: Record<ModelsMembershipTierType, string> = {
  regular: 'レギュラー',
  silver: 'シルバー',
  gold: 'ゴールド',
  platinum: 'プラチナ',
  vip: 'VIP',
}

/** The rank of a member, in a word. */
export const tierNameOf = (tier: ModelsMembershipTierType): string =>
  TIER_NAMES[tier]

/** The ranks, in the order of the contract: from the first to the highest. */
export const TIERS: readonly ModelsMembershipTierType[] = Object.values(
  ModelsMembershipTierType,
)

const STATUS_NAMES: Record<ModelsCustomerStatusType, string> = {
  active: '通常',
  inactive: '休眠',
  vip: 'VIP',
  blacklisted: '利用停止',
}

/** The state of a customer in the ledger, in a word. */
export const customerStatusNameOf = (
  status: ModelsCustomerStatusType,
): string => STATUS_NAMES[status]

const STATUS_TONES: Record<ModelsCustomerStatusType, BadgeTone> = {
  active: 'success',
  inactive: 'neutral',
  vip: 'info',
  blacklisted: 'danger',
}

/** The tone a state is shown in: one that keeps a customer from booking stands out. */
export const customerStatusToneOf = (
  status: ModelsCustomerStatusType,
): BadgeTone => STATUS_TONES[status]

/** The states, in the order of the contract. */
export const CUSTOMER_STATUSES: readonly ModelsCustomerStatusType[] =
  Object.values(ModelsCustomerStatusType)

const GENDER_NAMES: Record<ModelsCustomerGenderType, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
  prefer_not_to_say: '回答しない',
}

export const GENDERS: readonly ModelsCustomerGenderType[] = Object.values(
  ModelsCustomerGenderType,
)

/** The kinds of service, in the order of the contract. */
export const CATEGORIES: readonly ModelsServiceCategoryType[] = Object.values(
  ModelsServiceCategoryType,
)

const HAIR_TYPE_NAMES: Record<ModelsHairType, string> = {
  straight: 'ストレート',
  wavy: 'ウェーブ',
  curly: 'カール',
  coily: '強いカール',
}

export const HAIR_TYPES: readonly ModelsHairType[] =
  Object.values(ModelsHairType)

const HAIR_THICKNESS_NAMES: Record<ModelsHairThicknessType, string> = {
  thin: '細い',
  medium: 'ふつう',
  thick: '太い',
}

export const HAIR_THICKNESSES: readonly ModelsHairThicknessType[] =
  Object.values(ModelsHairThicknessType)

const SCALP_CONDITION_NAMES: Record<ModelsScalpConditionType, string> = {
  normal: 'ふつう',
  dry: '乾燥',
  oily: '脂性',
  sensitive: '敏感',
  dandruff: 'フケが出やすい',
}

export const SCALP_CONDITIONS: readonly ModelsScalpConditionType[] =
  Object.values(ModelsScalpConditionType)

/** What the forms offer of each enum, under the names of its values. */
export const TIER_OPTIONS: readonly Option[] = TIERS.map((tier) => ({
  value: tier,
  label: TIER_NAMES[tier],
}))

export const STATUS_OPTIONS: readonly Option[] = CUSTOMER_STATUSES.map(
  (status) => ({ value: status, label: STATUS_NAMES[status] }),
)

export const GENDER_OPTIONS: readonly Option[] = GENDERS.map((gender) => ({
  value: gender,
  label: GENDER_NAMES[gender],
}))

export const CATEGORY_OPTIONS: readonly Option[] = CATEGORIES.map(
  (category) => ({ value: category, label: categoryNameOf(category) }),
)

export const HAIR_TYPE_OPTIONS: readonly Option[] = HAIR_TYPES.map(
  (hairType) => ({ value: hairType, label: HAIR_TYPE_NAMES[hairType] }),
)

export const HAIR_THICKNESS_OPTIONS: readonly Option[] = HAIR_THICKNESSES.map(
  (thickness) => ({ value: thickness, label: HAIR_THICKNESS_NAMES[thickness] }),
)

export const SCALP_CONDITION_OPTIONS: readonly Option[] = SCALP_CONDITIONS.map(
  (condition) => ({
    value: condition,
    label: SCALP_CONDITION_NAMES[condition],
  }),
)

/** What is said of a value that was not given. */
export const UNRECORDED = '未登録'

/** The gender of a customer, if they gave it. */
export const genderNameOf = (
  gender: ModelsCustomerGenderType | null,
): string => (gender === null ? UNRECORDED : GENDER_NAMES[gender])

/** The kinds of service a customer likes, in the order of the contract. */
export const categoriesNameOf = (
  categories: readonly ModelsServiceCategoryType[],
): string =>
  categories.length === 0
    ? UNRECORDED
    : CATEGORIES.filter((category) => categories.includes(category))
        .map((category) => categoryNameOf(category))
        .join('、')

/** The hair and the scalp of a customer, what of them was recorded: 「ストレート、細い髪、頭皮は乾燥」. */
export const hairNameOf = ({
  hairType,
  hairThickness,
  scalpCondition,
}: Pick<
  ModelsCustomerResponse,
  'hairType' | 'hairThickness' | 'scalpCondition'
>): string => {
  const parts = [
    hairType === null ? null : HAIR_TYPE_NAMES[hairType],
    hairThickness === null ? null : `${HAIR_THICKNESS_NAMES[hairThickness]}髪`,
    scalpCondition === null
      ? null
      : `頭皮は${SCALP_CONDITION_NAMES[scalpCondition]}`,
  ].filter((part) => part !== null)

  return parts.length === 0 ? UNRECORDED : parts.join('、')
}

/** Where a customer lives, as an envelope says it: 「〒150-0001 東京都渋谷区神宮前 4-1-1 ハイツ 101」. */
export const addressNameOf = ({
  postalCode,
  prefecture,
  city,
  address,
  building,
}: Pick<
  ModelsCustomerResponse,
  'postalCode' | 'prefecture' | 'city' | 'address' | 'building'
>): string => {
  const place = [prefecture, city, address]
    .filter((part) => part !== null)
    .join('')
  const parts = [
    postalCode === null ? null : `〒${postalCode}`,
    place === '' ? null : place,
    building,
  ].filter((part) => part !== null)

  return parts.length === 0 ? UNRECORDED : parts.join(' ')
}

/** How a customer may be reached: the ways they allowed, or that there is none. */
export const contactsNameOf = ({
  allowEmail,
  allowSms,
  allowMarketing,
}: Pick<
  ModelsCustomerResponse,
  'allowEmail' | 'allowSms' | 'allowMarketing'
>): string => {
  const allowed = [
    allowEmail ? 'メール' : null,
    allowSms ? 'SMS' : null,
    allowMarketing ? 'キャンペーンなどのお知らせ' : null,
  ].filter((way) => way !== null)

  return allowed.length === 0 ? '受け取らない' : allowed.join('、')
}

/** A share in percent, as the API rounds it: 「12.5%」. */
export const rateNameOf = (rate: number): string =>
  `${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(rate)}%`

/** A count, with what it counts: 「3 回」. */
export const countNameOf = (count: number, unit: string): string =>
  `${new Intl.NumberFormat('ja-JP').format(count)} ${unit}`
