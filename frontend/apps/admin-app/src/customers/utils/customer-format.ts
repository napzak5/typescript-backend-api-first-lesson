import {
  type ModelsCustomerGenderType,
  type ModelsCustomerResponse,
  ModelsCustomerStatusType,
  ModelsHairThicknessType,
  ModelsHairType,
  ModelsMembershipTierType,
  ModelsScalpConditionType,
  type ModelsServiceCategoryType,
  type ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { SERVICE_CATEGORIES } from '@beauty-salon-frontend/fields'
import {
  type BadgeTone,
  type NamedChoice,
  NONE,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import {
  adminCustomerMessages,
  adminStaffMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'

const { items } = adminCustomerMessages

/*
 * How the screens of the ledger of the customers name what it holds: the
 * values of its enums, and what a few properties come to together. A name
 * is a message, which the component that shows it says in the language of
 * the page.
 */

const TIER_NAMES: Record<ModelsMembershipTierType, LocalizedText> =
  termMessages.membershipTier

/** The rank of a member, in a word. */
export const tierNameOf = (tier: ModelsMembershipTierType): LocalizedText =>
  TIER_NAMES[tier]

/** The ranks, in the order of the contract: from the first to the highest. */
export const TIERS: readonly ModelsMembershipTierType[] = Object.values(
  ModelsMembershipTierType,
)

const STATUS_NAMES: Record<ModelsCustomerStatusType, LocalizedText> =
  adminCustomerMessages.statuses

/** The state of a customer in the ledger, in a word. */
export const customerStatusNameOf = (
  status: ModelsCustomerStatusType,
): LocalizedText => STATUS_NAMES[status]

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

const GENDER_NAMES: Record<ModelsCustomerGenderType, LocalizedText> =
  termMessages.gender

const CATEGORY_NAMES: Record<ModelsServiceCategoryType, LocalizedText> =
  termMessages.serviceCategory

const HAIR_TYPE_NAMES: Record<ModelsHairType, LocalizedText> =
  termMessages.hairType

export const HAIR_TYPES: readonly ModelsHairType[] =
  Object.values(ModelsHairType)

const HAIR_THICKNESS_NAMES: Record<ModelsHairThicknessType, LocalizedText> =
  termMessages.hairThickness

export const HAIR_THICKNESSES: readonly ModelsHairThicknessType[] =
  Object.values(ModelsHairThicknessType)

const SCALP_CONDITION_NAMES: Record<ModelsScalpConditionType, LocalizedText> =
  termMessages.scalpCondition

export const SCALP_CONDITIONS: readonly ModelsScalpConditionType[] =
  Object.values(ModelsScalpConditionType)

/** The choices of an enum, under the names of its values, in the order of the contract */
const choicesOf = <Value extends string>(
  values: readonly Value[],
  names: Record<Value, LocalizedText>,
): readonly NamedChoice[] =>
  values.map((value) => ({ value, label: names[value] }))

/** What the forms offer of each enum, under the names of its values. The gender and the kinds of service are the choices of `fields`. */
export const TIER_CHOICES: readonly NamedChoice[] = choicesOf(TIERS, TIER_NAMES)

export const STATUS_CHOICES: readonly NamedChoice[] = choicesOf(
  CUSTOMER_STATUSES,
  STATUS_NAMES,
)

export const HAIR_TYPE_CHOICES: readonly NamedChoice[] = choicesOf(
  HAIR_TYPES,
  HAIR_TYPE_NAMES,
)

export const HAIR_THICKNESS_CHOICES: readonly NamedChoice[] = choicesOf(
  HAIR_THICKNESSES,
  HAIR_THICKNESS_NAMES,
)

export const SCALP_CONDITION_CHOICES: readonly NamedChoice[] = choicesOf(
  SCALP_CONDITIONS,
  SCALP_CONDITION_NAMES,
)

/** The gender of a customer, or `null` when they did not give it. */
export const genderNameOf = (
  gender: ModelsCustomerGenderType | null,
): LocalizedText | null => (gender === null ? null : GENDER_NAMES[gender])

/** The kinds of service a customer likes, in the order of the contract: 「カット、カラー」, or that there is none. */
export const categoriesNameOf = (
  categories: readonly ModelsServiceCategoryType[],
): LocalizedText => {
  const liked = SERVICE_CATEGORIES.filter((category) =>
    categories.includes(category),
  )

  return liked.length === 0
    ? NONE
    : items.listed(liked.map((category) => CATEGORY_NAMES[category]))
}

/** The hair and the scalp of a customer, what of them was recorded: 「ストレート、細い髪、頭皮は乾燥」, or `null` when none was. */
export const hairNameOf = ({
  hairType,
  hairThickness,
  scalpCondition,
}: Pick<
  ModelsCustomerResponse,
  'hairType' | 'hairThickness' | 'scalpCondition'
>): LocalizedText | null =>
  items.hairOf(
    hairType === null ? null : HAIR_TYPE_NAMES[hairType],
    hairThickness === null ? null : HAIR_THICKNESS_NAMES[hairThickness],
    scalpCondition === null ? null : SCALP_CONDITION_NAMES[scalpCondition],
  )

/** Where a customer lives, as an envelope says it: 「〒150-0001 東京都渋谷区神宮前 4-1-1 ハイツ 101」, or `null` when nothing of it was recorded. */
export const addressNameOf = ({
  postalCode,
  prefecture,
  city,
  address,
  building,
}: Pick<
  ModelsCustomerResponse,
  'postalCode' | 'prefecture' | 'city' | 'address' | 'building'
>): LocalizedText | null =>
  items.addressOf(
    postalCode,
    [prefecture, city, address].filter((part) => part !== null),
    building,
  )

/** How a customer may be reached: the ways they allowed, or that there is none. */
export const contactsNameOf = ({
  allowEmail,
  allowSms,
  allowMarketing,
}: Pick<
  ModelsCustomerResponse,
  'allowEmail' | 'allowSms' | 'allowMarketing'
>): LocalizedText =>
  items.contactsOf([
    ...(allowEmail ? [items.byEmail] : []),
    ...(allowSms ? [items.bySms] : []),
    ...(allowMarketing ? [items.marketing] : []),
  ])

/** A share in percent, as the API rounds it: 「12.5%」. */
export const rateNameOf = (rate: number): LocalizedText =>
  formats.percentOf(rate, { most: 1 })

/**
 * The members of the staff with the given IDs, by the names the salons
 * show them under, in the order of the IDs. One who has no profile among
 * `staff` is shown by no salon any more (removed, or not working there
 * now): the ledger says that there is one. A name stands as it was
 * written, in every language.
 */
export const staffNamesOf = (
  ids: readonly string[],
  staff: ReadonlyMap<string, Pick<ModelsStaffProfileResponse, 'displayName'>>,
): LocalizedText[] =>
  ids.map((id) => {
    const name = staff.get(id)?.displayName

    return name === undefined
      ? adminStaffMessages.unlisted
      : adminStaffMessages.named(name)
  })
