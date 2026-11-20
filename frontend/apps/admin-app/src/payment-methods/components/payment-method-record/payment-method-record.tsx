import type { ModelsPaymentMethodResponse } from '@beauty-salon-frontend/api-client'
import { Card, DescriptionList } from '@beauty-salon-frontend/ui'
import { methodKindNameOf } from '../../../sales/sale-format'
import { NOT_RECORDED } from '../../../staff/staff-format'
import {
  amountsNameOf,
  feeNameOf,
  placesNameOf,
  usedNameOf,
} from '../../payment-method-format'
import styles from './payment-method-record.module.css'

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
          description:
            method.description === null ? (
              NOT_RECORDED
            ) : (
              <p className={styles['written']}>{method.description}</p>
            ),
        },
        { term: '1 回の金額', description: amountsNameOf(method, currency) },
        { term: '手数料率', description: feeNameOf(method.fee) },
        {
          term: '決済代行会社',
          description: method.processorName ?? NOT_RECORDED,
        },
        { term: '使う場所', description: placesNameOf(method) },
        { term: '状態', description: usedNameOf(method.isActive) },
        { term: '並び順', description: String(method.sortOrder) },
      ]}
    />
  </Card>
)
