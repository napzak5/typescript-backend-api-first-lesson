import {
  type ModelsPaymentMethodResponse,
  ModelsPaymentMethodType,
} from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  methodKindNameOf,
} from '@beauty-salon-frontend/salon-screens'
import type { ChoiceOption } from '@beauty-salon-frontend/ui'
import { inJapanese } from '@beauty-salon-frontend/ui'
import { match, P } from 'ts-pattern'

/*
 * How the payment methods of a salon are named on the screens: the kinds
 * in the words of the sales, and the values a method keeps.
 */

/** The kinds of payment, in the order of the contract */
export const METHOD_KINDS: readonly ModelsPaymentMethodType[] = Object.values(
  ModelsPaymentMethodType,
)

/** The kinds of payment to choose from */
export const KIND_OPTIONS: readonly ChoiceOption[] = METHOD_KINDS.map(
  (kind) => ({
    value: kind,
    label: inJapanese(methodKindNameOf(kind)),
  }),
)

/** The rate of the fee: 「3.6%」, 「手数料なし」, or `null` when it is not recorded. */
export const feeNameOf = (fee: number | null): string | null =>
  fee === null ? null : fee === 0 ? '手数料なし' : `${fee}%`

/** What a method takes at once: 「￥1,000から」, 「￥1,000から￥20,000まで」, 「下限も上限もなし」. */
export const amountsNameOf = (
  {
    minimumAmount,
    maximumAmount,
  }: Pick<ModelsPaymentMethodResponse, 'minimumAmount' | 'maximumAmount'>,
  currency: string,
): string =>
  match([minimumAmount, maximumAmount])
    .returnType<string>()
    .with([null, null], () => '下限も上限もなし')
    .with(
      [P.number, null],
      ([least]) => `${inJapanese(amountOf(least, currency))}から`,
    )
    .with(
      [null, P.number],
      ([, most]) => `${inJapanese(amountOf(most, currency))}まで`,
    )
    .with(
      [P.number, P.number],
      ([least, most]) =>
        `${inJapanese(amountOf(least, currency))}から${inJapanese(amountOf(most, currency))}まで`,
    )
    .exhaustive()

/** Where a method is used: 「店頭、オンライン」, or 「どちらでも使わない」. */
export const placesNameOf = ({
  isOfflineEnabled,
  isOnlineEnabled,
}: Pick<
  ModelsPaymentMethodResponse,
  'isOfflineEnabled' | 'isOnlineEnabled'
>): string => {
  const places = [
    ...(isOfflineEnabled ? ['店頭'] : []),
    ...(isOnlineEnabled ? ['オンライン'] : []),
  ]

  return places.length === 0 ? 'どちらでも使わない' : places.join('、')
}

/** Whether the salon uses a method now. */
export const usedNameOf = (isActive: boolean): string =>
  isActive ? '使っている' : '使っていない'

/** The place a new method takes in the order: after the last one. */
export const nextSortOrderOf = (
  methods: readonly Pick<ModelsPaymentMethodResponse, 'sortOrder'>[],
): number => Math.max(0, ...methods.map(({ sortOrder }) => sortOrder)) + 1
