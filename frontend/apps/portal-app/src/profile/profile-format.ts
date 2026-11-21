import {
  ModelsCustomerGenderType,
  type ModelsCustomerProfileResponse,
  type ModelsHairThicknessType,
  type ModelsHairType,
  type ModelsMembershipTierType,
  type ModelsScalpConditionType,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'

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

const GENDER_NAMES: Record<ModelsCustomerGenderType, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
  prefer_not_to_say: '回答しない',
}

const CATEGORY_NAMES: Record<ModelsServiceCategoryType, string> = {
  cut: 'カット',
  color: 'カラー',
  perm: 'パーマ',
  treatment: 'トリートメント',
  spa: 'スパ',
  styling: 'スタイリング',
  extension: 'エクステンション',
  other: 'その他',
}

type Option = { value: string; label: string }

/** What the form offers as a gender, in the order of the contract. */
export const GENDER_OPTIONS: readonly Option[] = Object.values(
  ModelsCustomerGenderType,
).map((gender) => ({ value: gender, label: GENDER_NAMES[gender] }))

/** The kinds of service the form offers, in the order of the contract. */
export const CATEGORY_OPTIONS: readonly Option[] = Object.values(
  ModelsServiceCategoryType,
).map((category) => ({ value: category, label: CATEGORY_NAMES[category] }))

const HAIR_TYPE_NAMES: Record<ModelsHairType, string> = {
  straight: 'ストレート',
  wavy: 'ウェーブ',
  curly: 'カール',
  coily: '強いカール',
}

const HAIR_THICKNESS_NAMES: Record<ModelsHairThicknessType, string> = {
  thin: '細い',
  medium: 'ふつう',
  thick: '太い',
}

const SCALP_CONDITION_NAMES: Record<ModelsScalpConditionType, string> = {
  normal: 'ふつう',
  dry: '乾燥',
  oily: '脂性',
  sensitive: '敏感',
  dandruff: 'フケが出やすい',
}

/** A day of the calendar, as it is written: 「2026年11月9日」. It is read in no time zone. */
export const calendarDayOf = (date: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))

/**
 * The calendar date it is where the browser is: `2026-11-19`. It is the
 * last day somebody can have been born on. (The API takes a day of birth
 * until the day after today in UTC, and no place is further ahead.)
 */
export const localDateOf = (moment: Date): string =>
  new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment)

/** A number of points: 「2,500 ポイント」. */
export const pointsOf = (points: number): string =>
  `${new Intl.NumberFormat('ja-JP').format(points)} ポイント`

/** How often a customer came: 「12 回」. */
export const visitsOf = (count: number): string =>
  `${new Intl.NumberFormat('ja-JP').format(count)} 回`

/** The name of a customer, the family name first. */
export const fullNameOf = ({
  lastName,
  firstName,
}: Pick<ModelsCustomerProfileResponse, 'lastName' | 'firstName'>): string =>
  `${lastName} ${firstName}`

/** How the name is read, the family name first; `null` when neither part is there. */
export const kanaOf = ({
  lastNameKana,
  firstNameKana,
}: Pick<ModelsCustomerProfileResponse, 'lastNameKana' | 'firstNameKana'>):
  | string
  | null => {
  const parts = [lastNameKana, firstNameKana].filter((part) => part !== null)

  return parts.length === 0 ? null : parts.join(' ')
}

/**
 * Where a customer lives, a line for each of what a letter has: the
 * postal code, the address as it was written, and the building. No line
 * when nothing of it is there.
 */
export const addressLinesOf = ({
  postalCode,
  prefecture,
  city,
  address,
  building,
}: Pick<
  ModelsCustomerProfileResponse,
  'postalCode' | 'prefecture' | 'city' | 'address' | 'building'
>): string[] => {
  const street = [prefecture, city, address].filter((part) => part !== null)

  return [
    ...(postalCode === null ? [] : [`〒${postalCode}`]),
    ...(street.length === 0 ? [] : [street.join(' ')]),
    ...(building === null ? [] : [building]),
  ]
}

export const genderNameOf = (gender: ModelsCustomerGenderType): string =>
  GENDER_NAMES[gender]

/** The kinds of service a customer likes, in the order the form offers them. */
export const categoryNamesOf = (
  categories: readonly ModelsServiceCategoryType[],
): string[] =>
  Object.values(ModelsServiceCategoryType)
    .filter((category) => categories.includes(category))
    .map((category) => CATEGORY_NAMES[category])

/** The ways a customer lets a salon reach them: those that are allowed, by name. */
export const contactsOf = ({
  allowEmail,
  allowSms,
  allowMarketing,
}: Pick<
  ModelsCustomerProfileResponse,
  'allowEmail' | 'allowSms' | 'allowMarketing'
>): string[] => [
  ...(allowEmail ? ['メールでの連絡'] : []),
  ...(allowSms ? ['SMS での連絡'] : []),
  ...(allowMarketing ? ['キャンペーンなどのお知らせ'] : []),
]

/**
 * What a salon wrote down of the hair of a customer, as names and values.
 * What no salon wrote down is said to be missing: a name without a value
 * would look like a fault.
 */
export const hairOf = ({
  hairType,
  hairThickness,
  scalpCondition,
}: Pick<
  ModelsCustomerProfileResponse,
  'hairType' | 'hairThickness' | 'scalpCondition'
>): { term: string; description: string | null }[] => [
  {
    term: '髪質',
    description: hairType === null ? null : HAIR_TYPE_NAMES[hairType],
  },
  {
    term: '髪の太さ',
    description:
      hairThickness === null ? null : HAIR_THICKNESS_NAMES[hairThickness],
  },
  {
    term: '頭皮の状態',
    description:
      scalpCondition === null ? null : SCALP_CONDITION_NAMES[scalpCondition],
  },
]
