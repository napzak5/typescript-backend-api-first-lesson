import type {
  ModelsPaymentMethodType,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'

/** An amount in the currency of the salon: 「￥5,500」, "¥5,500". */
export const amountOf = (amount: number, currency: string): LocalizedText =>
  formats.amountOf(amount, currency)

const METHOD_NAMES: Record<ModelsPaymentMethodType, LocalizedText> =
  termMessages.paymentMethod

/** A kind of payment, in the word the salon uses. */
export const methodKindNameOf = (
  method: ModelsPaymentMethodType,
): LocalizedText => METHOD_NAMES[method]

const CATEGORY_NAMES: Record<ModelsServiceCategoryType, LocalizedText> =
  termMessages.serviceCategory

/** A kind of service: 「カラー」, "Color". */
export const categoryNameOf = (
  category: ModelsServiceCategoryType,
): LocalizedText => CATEGORY_NAMES[category]
