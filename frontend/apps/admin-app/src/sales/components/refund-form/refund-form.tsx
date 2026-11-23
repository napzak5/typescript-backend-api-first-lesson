import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Card,
  DescriptionList,
  Form,
  type FormProps,
  inJapanese,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { cardNameOf, methodNameOf } from '../../utils/sale-format'
import styles from './refund-form.module.css'

export type RefundFormProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The payment that is given back */
  payment: ModelsPaymentResponse
  /** The payment methods of the salon, those it uses no more as well */
  methods: readonly Pick<ModelsPaymentMethodResponse, 'id' | 'displayName'>[]
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
}

/**
 * A payment, and how much of it was given back and why. The whole of it at
 * first: a payment is given back once, so what is left of one that was
 * given back in part stays, and so does its sale. The form says so.
 */
export const RefundForm = ({
  payment,
  methods,
  timezone,
  currency,
  errors = {},
  ...form
}: RefundFormProps) => (
  <div className={styles['refund']}>
    <Card title='返金する支払い'>
      <DescriptionList
        items={[
          { term: '取引番号', description: payment.transactionNumber },
          {
            term: '受けた日時',
            description: inJapanese(
              momentNameAt(payment.processedAt ?? payment.createdAt, timezone),
            ),
          },
          {
            term: '支払い方法',
            description: methodNameOf(payment.paymentMethodId, methods),
          },
          {
            term: '金額',
            description: inJapanese(amountOf(payment.amount, currency)),
          },
          { term: 'カード', description: cardNameOf(payment) },
        ]}
      />
    </Card>
    <Form {...form} errors={errors} submitLabel='返金を記録する'>
      <TextField
        width='short'
        label='返金する金額'
        name='refundAmount'
        inputMode='numeric'
        autoComplete='off'
        required
        defaultValue={String(payment.amount)}
        description={`円の整数で、1 円から支払いの金額（${inJapanese(amountOf(payment.amount, currency))}）まで入れます。1 件の支払いの返金は 1 回です。一部だけ返金すると、残りは返金できず、売上も取り消せなくなります。`}
        error={errors['refundAmount']}
      />
      <TextArea
        label='返金の理由'
        name='refundReason'
        required
        description='返金の記録に残ります。お金を返してから記録します。'
        error={errors['refundReason']}
      />
    </Form>
  </div>
)
