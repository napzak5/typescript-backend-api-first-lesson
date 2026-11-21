import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  type DescriptionListItem,
  TagList,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import {
  addressNameOf,
  categoriesNameOf,
  contactsNameOf,
  customerStatusNameOf,
  customerStatusToneOf,
  genderNameOf,
  hairNameOf,
  tierNameOf,
  UNRECORDED,
} from '../../customer-format'
import { customerKanaOf, customerNameOf } from '../../customers-api'

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
  term: string
  /** The values the item shows */
  fields: readonly (keyof LedgerValues)[]
  /** What of them the item shows, when it is not the whole of them */
  shows?: (values: LedgerValues) => unknown
  /** How the item shows them; `referrer` is how the customer who referred them is shown */
  describe: (values: LedgerValues, referrer: ReactNode) => ReactNode
}

const NONE = 'なし'

/** A text that was written in several lines, with its line breaks. */
const written = (text: string | null) =>
  text === null ? UNRECORDED : <WrittenText>{text}</WrittenText>

/** The items of the ledger, in the order the page of a customer shows them. */
const ITEMS: readonly LedgerItemOf[] = [
  {
    term: 'お名前',
    fields: ['lastName', 'firstName'],
    describe: customerNameOf,
  },
  {
    term: 'フリガナ',
    fields: ['lastNameKana', 'firstNameKana'],
    describe: (values) => {
      const kana = customerKanaOf(values)

      return kana === '' ? UNRECORDED : kana
    },
  },
  { term: 'メールアドレス', fields: ['email'], describe: ({ email }) => email },
  {
    term: '電話番号',
    fields: ['phoneNumber'],
    describe: ({ phoneNumber }) => phoneNumber,
  },
  {
    term: '予備の電話番号',
    fields: ['alternativePhone'],
    describe: ({ alternativePhone }) => alternativePhone ?? UNRECORDED,
  },
  {
    term: '住所',
    fields: ['postalCode', 'prefecture', 'city', 'address', 'building'],
    describe: addressNameOf,
  },
  {
    term: '生年月日',
    fields: ['birthDate'],
    describe: ({ birthDate }) =>
      birthDate === null ? UNRECORDED : dayNameOf(birthDate),
  },
  {
    term: '性別',
    fields: ['gender'],
    describe: ({ gender }) => genderNameOf(gender),
  },
  {
    term: '職業',
    fields: ['occupation'],
    describe: ({ occupation }) => occupation ?? UNRECORDED,
  },
  {
    term: '髪と頭皮',
    fields: ['hairType', 'hairThickness', 'scalpCondition'],
    describe: hairNameOf,
  },
  {
    term: '好みのメニュー',
    fields: ['preferences'],
    shows: ({ preferences }) => preferences?.preferredServices ?? [],
    describe: ({ preferences }) =>
      categoriesNameOf(preferences?.preferredServices ?? []),
  },
  {
    term: '好みについてのメモ',
    fields: ['preferences'],
    shows: ({ preferences }) => preferences?.notes ?? null,
    describe: ({ preferences }) => written(preferences?.notes ?? null),
  },
  {
    term: '会員ランク',
    fields: ['membershipTier'],
    describe: ({ membershipTier }) => tierNameOf(membershipTier),
  },
  {
    term: 'ステータス',
    fields: ['customerStatus'],
    describe: ({ customerStatus }) => (
      <Badge tone={customerStatusToneOf(customerStatus)}>
        {customerStatusNameOf(customerStatus)}
      </Badge>
    ),
  },
  {
    term: '有効',
    fields: ['isActive'],
    describe: ({ isActive }) =>
      isActive ? '有効' : '無効（ご自分では予約を入れられません）',
  },
  {
    term: 'タグ',
    fields: ['tags'],
    describe: ({ tags }) =>
      tags.length === 0 ? NONE : <TagList label='タグ' items={tags} />,
  },
  {
    term: '紹介コード',
    fields: ['referralCode'],
    describe: ({ referralCode }) => referralCode ?? '未発行',
  },
  {
    term: '紹介元',
    fields: ['referredBy'],
    describe: ({ referredBy }, referrer) =>
      referredBy === null ? NONE : referrer,
  },
  {
    term: '送ってよい連絡',
    fields: ['allowEmail', 'allowSms', 'allowMarketing'],
    describe: contactsNameOf,
  },
  { term: '備考', fields: ['notes'], describe: ({ notes }) => written(notes) },
  {
    term: 'スタッフ間の申し送り',
    fields: ['internalNotes'],
    describe: ({ internalNotes }) => written(internalNotes),
  },
]

/**
 * What the ledger keeps of a customer, as the items of a description list.
 * `referrer` is how the customer who referred them is shown, when somebody
 * did: their name, or a link to them.
 */
export const ledgerItemsOf = (
  values: LedgerValues,
  referrer: ReactNode,
): DescriptionListItem[] =>
  ITEMS.map(({ term, describe }) => ({
    term,
    description: describe(values, referrer),
  }))

/**
 * The items of the ledger that show any of the values a version changed,
 * named as the page of a customer names them, in its order. A value the
 * ledger does not know is named as the API names it.
 */
export const changedTermsOf = (fields: readonly string[]): string[] => {
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
 * shows in both, in the order of the page of a customer. An item that
 * shows the same in both is left out, though a value it shows a part of
 * changed in another part.
 */
export const changedItemsOf = (
  before: LedgerValues,
  after: LedgerValues,
  referrerOf: (values: LedgerValues) => ReactNode,
): ChangedItem[] =>
  ITEMS.filter((item) => shownBy(item, before) !== shownBy(item, after)).map(
    ({ term, describe }) => ({
      term,
      before: describe(before, referrerOf(before)),
      after: describe(after, referrerOf(after)),
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
 * the page of a customer. An item that shows the same for both is left
 * out: a merge keeps it.
 */
export const comparedItemsOf = (
  primary: LedgerValues,
  secondary: LedgerValues,
  merged: LedgerValues,
  referrerOf: (values: LedgerValues) => ReactNode,
): ComparedItem[] =>
  ITEMS.filter(
    (item) => shownBy(item, primary) !== shownBy(item, secondary),
  ).map(({ term, describe }) => ({
    term,
    primary: describe(primary, referrerOf(primary)),
    secondary: describe(secondary, referrerOf(secondary)),
    merged: describe(merged, referrerOf(merged)),
  }))
