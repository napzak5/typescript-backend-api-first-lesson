import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Card,
  DescriptionList,
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { cardNameOf, methodNameOf, receivedAtOf } from '../../utils/sale-format'
import styles from './refund-form.module.css'

const { words } = adminSaleMessages
const { refund: texts } = adminSaleMessages.payments

export type RefundFormProps = Pick<
  FormProps,
  'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
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
  message,
  errors = NO_ERRORS,
  ...form
}: RefundFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const card = cardNameOf(payment)

  return (
    <div className={styles['refund']}>
      <Card title={say(texts.payment)}>
        <DescriptionList
          items={[
            {
              term: say(words.transactionNumber),
              description: payment.transactionNumber,
            },
            {
              term: say(words.receivedAt),
              description: say(momentNameAt(receivedAtOf(payment), timezone)),
            },
            {
              term: say(words.method),
              description: say(methodNameOf(payment.paymentMethodId, methods)),
            },
            {
              term: say(words.amount),
              description: say(amountOf(payment.amount, currency)),
            },
            {
              term: say(words.card),
              description: card === null ? null : say(card),
            },
          ]}
        />
      </Card>
      <Form
        {...form}
        message={said.message}
        errors={errors}
        submitLabel={say(texts.submit)}
      >
        <TextField
          width='short'
          label={say(texts.amount)}
          name='refundAmount'
          inputMode='numeric'
          autoComplete='off'
          required
          defaultValue={String(payment.amount)}
          description={say(
            texts.amountDescription(amountOf(payment.amount, currency)),
          )}
          error={said.errors['refundAmount']}
        />
        <TextArea
          label={say(texts.reason)}
          name='refundReason'
          required
          description={say(texts.reasonDescription)}
          error={said.errors['refundReason']}
        />
      </Form>
    </div>
  )
}
