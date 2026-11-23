import type {
  ModelsCustomerGenderType,
  ModelsCustomerProfileResponse,
  ModelsHairThicknessType,
  ModelsHairType,
  ModelsScalpConditionType,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'
import { GENDERS, SERVICE_CATEGORIES } from '@beauty-salon-frontend/fields'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalProfileMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'

const { details, membership } = portalProfileMessages

const GENDER_NAMES: Record<ModelsCustomerGenderType, LocalizedText> =
  termMessages.gender

const CATEGORY_NAMES: Record<ModelsServiceCategoryType, LocalizedText> =
  termMessages.serviceCategory

/** A choice of the form: the value it sends, and its name, which the form says */
export type NamedChoice = { value: string; label: LocalizedText }

/** What the form offers as a gender, in the order of the contract. */
export const GENDER_CHOICES: readonly NamedChoice[] = GENDERS.map((gender) => ({
  value: gender,
  label: GENDER_NAMES[gender],
}))

/** The kinds of service the form offers, in the order of the contract. */
export const CATEGORY_CHOICES: readonly NamedChoice[] = SERVICE_CATEGORIES.map(
  (category) => ({ value: category, label: CATEGORY_NAMES[category] }),
)

const HAIR_TYPE_NAMES: Record<ModelsHairType, LocalizedText> =
  termMessages.hairType

const HAIR_THICKNESS_NAMES: Record<ModelsHairThicknessType, LocalizedText> =
  termMessages.hairThickness

const SCALP_CONDITION_NAMES: Record<ModelsScalpConditionType, LocalizedText> =
  termMessages.scalpCondition

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
>): (string | LocalizedText)[] => {
  const street = [prefecture, city, address].filter((part) => part !== null)

  return [
    ...(postalCode === null ? [] : [details.postalCode(postalCode)]),
    ...(street.length === 0 ? [] : [street.join(' ')]),
    ...(building === null ? [] : [building]),
  ]
}

/** The kinds of service a customer likes, in the order the form offers them. */
export const categoryNamesOf = (
  categories: readonly ModelsServiceCategoryType[],
): LocalizedText[] =>
  SERVICE_CATEGORIES.filter((category) => categories.includes(category)).map(
    (category) => CATEGORY_NAMES[category],
  )

/** The ways a customer lets a salon reach them: those that are allowed, by name. */
export const contactsOf = ({
  allowEmail,
  allowSms,
  allowMarketing,
}: Pick<
  ModelsCustomerProfileResponse,
  'allowEmail' | 'allowSms' | 'allowMarketing'
>): LocalizedText[] => [
  ...(allowEmail ? [details.byEmail] : []),
  ...(allowSms ? [details.bySms] : []),
  ...(allowMarketing ? [details.marketing] : []),
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
>): { term: LocalizedText; description: LocalizedText | null }[] => [
  {
    term: membership.hairType,
    description: hairType === null ? null : HAIR_TYPE_NAMES[hairType],
  },
  {
    term: membership.hairThickness,
    description:
      hairThickness === null ? null : HAIR_THICKNESS_NAMES[hairThickness],
  },
  {
    term: membership.scalpCondition,
    description:
      scalpCondition === null ? null : SCALP_CONDITION_NAMES[scalpCondition],
  },
]
