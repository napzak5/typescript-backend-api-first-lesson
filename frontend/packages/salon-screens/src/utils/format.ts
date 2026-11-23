import type {
  ModelsPaymentMethodType,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'
import { inJapanese } from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'

/** An amount in the currency of the salon: 「￥5,500」. */
export const amountOf = (amount: number, currency: string): string =>
  inJapanese(formats.amountOf(amount, currency))

const METHOD_NAMES: Record<ModelsPaymentMethodType, string> = {
  cash: '現金',
  credit_card: 'クレジットカード',
  debit_card: 'デビットカード',
  e_money: '電子マネー',
  qr_payment: 'QR コード決済',
  bank_transfer: '銀行振込',
  point: 'ポイント',
}

/** A kind of payment, in the word the salon uses. */
export const methodKindNameOf = (method: ModelsPaymentMethodType): string =>
  METHOD_NAMES[method]

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

/** A kind of service: 「カラー」. */
export const categoryNameOf = (category: ModelsServiceCategoryType): string =>
  CATEGORY_NAMES[category]
