import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  type DescriptionListItem,
  NONE,
  TagList,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import { customerKanaOf, customerNameOf } from '../../api/customers-api'
import {
  addressNameOf,
  categoriesNameOf,
  contactsNameOf,
  customerStatusNameOf,
  customerStatusToneOf,
  genderNameOf,
  hairNameOf,
  tierNameOf,
} from '../../utils/customer-format'

const { items } = adminCustomerMessages

/** How the items are said: `useSay()` of the screen that shows them */
type Say = (message: LocalizedText) => string

/** A text or none, said */
const sayIfAny = (say: Say, message: LocalizedText | null): string | null =>
  message === null ? null : say(message)

/**
 * The values the ledger keeps of a customer and a version of them keeps
 * too: what the salon writes, not what the bookings and the points count.
 */
export type LedgerValues = Pick<
  ModelsCustomerResponse,
  | 'firstName'
  | 'lastName'
  | 'firstNameKana'
  | 'lastNameKana'
  | 'email'
  | 'phoneNumber'
  | 'alternativePhone'
  | 'postalCode'
  | 'prefecture'
  | 'city'
  | 'address'
  | 'building'
  | 'birthDate'
  | 'gender'
  | 'occupation'
  | 'membershipTier'
  | 'preferences'
  | 'notes'
  | 'internalNotes'
  | 'tags'
  | 'referredBy'
  | 'referralCode'
  | 'allowMarketing'
  | 'allowSms'
  | 'allowEmail'
  | 'isActive'
  | 'hairType'
  | 'hairThickness'
  | 'scalpCondition'
  | 'customerStatus'
>

type LedgerItemOf = {
  /** What the item is, as the page of a customer names it */
  term: LocalizedText
  /** The values the item shows */
  fields: readonly (keyof LedgerValues)[]
  /** What of them the item shows, when it is not the whole of them */
  shows?: (values: LedgerValues) => unknown
  /**
   * How the item shows them, in the language `say` says: `referrer` is how
   * the customer who referred them is shown
   */
  describe: (values: LedgerValues, referrer: ReactNode, say: Say) => ReactNode
}

/** The items of the ledger, in the order the page of a customer shows them. */
const ITEMS: readonly LedgerItemOf[] = [
  {
    term: items.name,
    fields: ['lastName', 'firstName'],
    describe: customerNameOf,
  },
  {
    term: items.kana,
    fields: ['lastNameKana', 'firstNameKana'],
    describe: (values) => {
      const kana = customerKanaOf(values)

      return kana === '' ? null : kana
    },
  },
  { term: items.email, fields: ['email'], describe: ({ email }) => email },
  {
    term: items.phoneNumber,
    fields: ['phoneNumber'],
    describe: ({ phoneNumber }) => phoneNumber,
  },
  {
    term: items.alternativePhone,
    fields: ['alternativePhone'],
    describe: ({ alternativePhone }) => alternativePhone,
  },
  {
    term: items.address,
    fields: ['postalCode', 'prefecture', 'city', 'address', 'building'],
    describe: (values, _referrer, say) => sayIfAny(say, addressNameOf(values)),
  },
  {
    term: items.birthDate,
    fields: ['birthDate'],
    describe: ({ birthDate }, _referrer, say) =>
      birthDate === null ? null : say(dayNameOf(birthDate)),
  },
  {
    term: items.gender,
    fields: ['gender'],
    describe: ({ gender }, _referrer, say) =>
      sayIfAny(say, genderNameOf(gender)),
  },
  {
    term: items.occupation,
    fields: ['occupation'],
    describe: ({ occupation }) => occupation,
  },
  {
    term: items.hair,
    fields: ['hairType', 'hairThickness', 'scalpCondition'],
    describe: (values, _referrer, say) => sayIfAny(say, hairNameOf(values)),
  },
  {
    term: items.preferredServices,
    fields: ['preferences'],
    shows: ({ preferences }) => preferences?.preferredServices ?? [],
    describe: ({ preferences }, _referrer, say) =>
      say(categoriesNameOf(preferences?.preferredServices ?? [])),
  },
  {
    term: items.preferenceNotes,
    fields: ['preferences'],
    shows: ({ preferences }) => preferences?.notes ?? null,
    describe: ({ preferences }) => (
      <WrittenText>{preferences?.notes ?? null}</WrittenText>
    ),
  },
  {
    term: items.membershipTier,
    fields: ['membershipTier'],
    describe: ({ membershipTier }, _referrer, say) =>
      say(tierNameOf(membershipTier)),
  },
  {
    term: items.status,
    fields: ['customerStatus'],
    describe: ({ customerStatus }, _referrer, say) => (
      <Badge tone={customerStatusToneOf(customerStatus)}>
        {say(customerStatusNameOf(customerStatus))}
      </Badge>
    ),
  },
  {
    term: items.active,
    fields: ['isActive'],
    describe: ({ isActive }, _referrer, say) =>
      say(isActive ? items.activeValue : items.inactiveValue),
  },
  {
    term: items.tags,
    fields: ['tags'],
    describe: ({ tags }, _referrer, say) => (
      <TagList label={say(items.tags)} items={tags} />
    ),
  },
  {
    term: items.referralCode,
    fields: ['referralCode'],
    describe: ({ referralCode }, _referrer, say) =>
      referralCode ?? say(items.notIssued),
  },
  {
    term: items.referredBy,
    fields: ['referredBy'],
    // The contract says what `null` is: the customer came without a referral
    describe: ({ referredBy }, referrer, say) =>
      referredBy === null ? say(NONE) : referrer,
  },
  {
    term: items.contacts,
    fields: ['allowEmail', 'allowSms', 'allowMarketing'],
    describe: (values, _referrer, say) => say(contactsNameOf(values)),
  },
  {
    term: items.notes,
    fields: ['notes'],
    describe: ({ notes }) => <WrittenText>{notes}</WrittenText>,
  },
  {
    term: items.internalNotes,
    fields: ['internalNotes'],
    describe: ({ internalNotes }) => <WrittenText>{internalNotes}</WrittenText>,
  },
]

/**
 * What the ledger keeps of a customer, as the items of a description list,
 * in the language `say` says. `referrer` is how the customer who referred
 * them is shown, when somebody did: their name, or a link to them.
 */
export const ledgerItemsOf = (
  values: LedgerValues,
  referrer: ReactNode,
  say: Say,
): DescriptionListItem[] =>
  ITEMS.map(({ term, describe }) => ({
    term: say(term),
    description: describe(values, referrer, say),
  }))

/**
 * The items of the ledger that show any of the values a version changed,
 * named as the page of a customer names them, in its order. A value the
 * ledger does not know is named as the API names it.
 */
export const changedTermsOf = (
  fields: readonly string[],
): (string | LocalizedText)[] => {
  const known = ITEMS.flatMap((item) => item.fields)

  return [
    ...ITEMS.filter((item) =>
      item.fields.some((field) => fields.includes(field)),
    ).map(({ term }) => term),
    ...fields.filter((field) => !known.some((one) => one === field)),
  ]
}

/** An item of the ledger that one version shows otherwise than the one before it. */
export type ChangedItem = {
  term: string
  before: ReactNode
  after: ReactNode
}

/** What an item shows of the values of a version, to compare it with another. */
const shownBy = (
  { fields, shows }: LedgerItemOf,
  values: LedgerValues,
): string =>
  JSON.stringify(
    shows === undefined ? fields.map((field) => values[field]) : shows(values),
  )

/**
 * The items of the ledger that differ between two versions, with what each
 * shows in both, in the order of the page of a customer and in the
 * language `say` says. An item that shows the same in both is left out,
 * though a value it shows a part of changed in another part.
 */
export const changedItemsOf = (
  before: LedgerValues,
  after: LedgerValues,
  referrerOf: (values: LedgerValues) => ReactNode,
  say: Say,
): ChangedItem[] =>
  ITEMS.filter((item) => shownBy(item, before) !== shownBy(item, after)).map(
    ({ term, describe }) => ({
      term: say(term),
      before: describe(before, referrerOf(before), say),
      after: describe(after, referrerOf(after), say),
    }),
  )

/** An item of the ledger that two customers show differently, and what a merge of them shows. */
export type ComparedItem = {
  term: string
  primary: ReactNode
  secondary: ReactNode
  merged: ReactNode
}

/**
 * The items of the ledger that two customers show differently, with what
 * each shows and what the customer made of both shows, in the order of
 * the page of a customer and in the language `say` says. An item that
 * shows the same for both is left out: a merge keeps it.
 */
export const comparedItemsOf = (
  primary: LedgerValues,
  secondary: LedgerValues,
  merged: LedgerValues,
  referrerOf: (values: LedgerValues) => ReactNode,
  say: Say,
): ComparedItem[] =>
  ITEMS.filter(
    (item) => shownBy(item, primary) !== shownBy(item, secondary),
  ).map(({ term, describe }) => ({
    term: say(term),
    primary: describe(primary, referrerOf(primary), say),
    secondary: describe(secondary, referrerOf(secondary), say),
    merged: describe(merged, referrerOf(merged), say),
  }))
