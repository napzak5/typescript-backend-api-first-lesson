import {
  type ModelsPaymentMethodResponse,
  ModelsPaymentMethodType,
} from '@beauty-salon-frontend/api-client'
import { methodKindNameOf } from '@beauty-salon-frontend/salon-screens'
import type { NamedChoice } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminPaymentMethodMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { amountLimitsOf } from '../../sales/utils/payments'

const { values } = adminPaymentMethodMessages

/*
 * How the payment methods of a salon are named on the screens: the kinds
 * in the words of the sales, and the values a method keeps.
 */

/** The kinds of payment, in the order of the contract */
export const METHOD_KINDS: readonly ModelsPaymentMethodType[] = Object.values(
  ModelsPaymentMethodType,
)

/** The kinds of payment to choose from */
export const KIND_CHOICES: readonly NamedChoice[] = METHOD_KINDS.map(
  (kind) => ({ value: kind, label: methodKindNameOf(kind) }),
)

/** The rate of the fee: 「3.6%」, 「手数料なし」, or `null` when it is not recorded. */
export const feeNameOf = (fee: number | null): LocalizedText | null =>
  fee === null ? null : fee === 0 ? values.noFee : formats.percentOf(fee)

/** What a method takes at once, as the sales say it: 「￥1,000から」, 「￥1,000から￥20,000まで」, 「下限も上限もなし」. */
export const amountsNameOf = (
  method: Pick<ModelsPaymentMethodResponse, 'minimumAmount' | 'maximumAmount'>,
  currency: string,
): LocalizedText => values.amounts(amountLimitsOf(method, currency))

/** Where a method is used: 「店頭、オンライン」, or 「どちらでも使わない」. */
export const placesNameOf = ({
  isOfflineEnabled,
  isOnlineEnabled,
}: Pick<
  ModelsPaymentMethodResponse,
  'isOfflineEnabled' | 'isOnlineEnabled'
>): LocalizedText =>
  values.placesOf([
    ...(isOfflineEnabled ? [values.offline] : []),
    ...(isOnlineEnabled ? [values.online] : []),
  ])

/** Whether the salon uses a method now. */
export const usedNameOf = (isActive: boolean): LocalizedText =>
  isActive ? values.inUse : values.notInUse

/** The place a new method takes in the order: after the last one. */
export const nextSortOrderOf = (
  methods: readonly Pick<ModelsPaymentMethodResponse, 'sortOrder'>[],
): number => Math.max(0, ...methods.map(({ sortOrder }) => sortOrder)) + 1
