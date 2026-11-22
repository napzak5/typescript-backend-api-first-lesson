import type { ModelsPaymentMethodResponse } from '@beauty-salon-frontend/api-client'
import { methodKindNameOf } from '@beauty-salon-frontend/salon-screens'
import { Card, DescriptionList, WrittenText } from '@beauty-salon-frontend/ui'
import {
  amountsNameOf,
  feeNameOf,
  placesNameOf,
  usedNameOf,
} from '../../payment-method-format'

export type PaymentMethodRecordProps = {
  method: ModelsPaymentMethodResponse
  currency: string
}

/**
 * Everything the salon keeps of a payment method: its name and kind, what
 * it takes at once, its fee and the company it goes through, where and
 * whether it is used, and its place in the order.
 */
export const PaymentMethodRecord = ({
  method,
  currency,
}: PaymentMethodRecordProps) => (
  <Card title='支払い方法'>
    <DescriptionList
      items={[
        { term: '表示名', description: method.displayName },
        { term: '種類', description: methodKindNameOf(method.method) },
        {
          term: '説明',
          description: <WrittenText>{method.description}</WrittenText>,
        },
        { term: '1 回の金額', description: amountsNameOf(method, currency) },
        { term: '手数料率', description: feeNameOf(method.fee) },
        {
          term: '決済代行会社',
          description: method.processorName,
        },
        { term: '使う場所', description: placesNameOf(method) },
        { term: '状態', description: usedNameOf(method.isActive) },
        { term: '並び順', description: String(method.sortOrder) },
      ]}
    />
  </Card>
)
