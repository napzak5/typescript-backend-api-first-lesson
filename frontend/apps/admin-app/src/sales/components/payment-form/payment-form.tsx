import type { ModelsPaymentMethodResponse } from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import {
  FieldRow,
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  RadioGroup,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useState } from 'react'
import { methodLabelOf, takesCard } from '../../utils/payments'

const { words } = adminSaleMessages
const { payment: texts } = adminSaleMessages.payments

export type PaymentFormProps = Pick<
  FormProps,
  'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /** The methods the salon receives a payment by now, in its order */
  methods: readonly ModelsPaymentMethodResponse[]
  /** What is left to pay of the sale: the amount at first */
  owed: number
  /** The currency of the salon */
  currency: string
}

/**
 * A payment of a sale: by which method, and how much, at most what is left
 * to pay. A payment by card records the card as far as it is known: its
 * last four digits and its brand, never its number. The controls of the
 * card are there while a card is chosen.
 */
export const PaymentForm = ({
  methods,
  owed,
  currency,
  message,
  errors = NO_ERRORS,
  ...form
}: PaymentFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const [chosen, setChosen] = useState('')
  const method = methods.find(({ id }) => id === chosen)

  return (
    <Form
      {...form}
      message={said.message}
      errors={errors}
      submitLabel={say(texts.submit)}
    >
      <RadioGroup
        label={say(words.method)}
        name='paymentMethodId'
        required
        options={methods.map((one) => ({
          value: one.id,
          label: say(methodLabelOf(one, currency)),
        }))}
        value={chosen}
        onChange={(event) => setChosen(event.target.value)}
        description={say(texts.methodDescription)}
        error={said.errors['paymentMethodId']}
      />
      <TextField
        width='short'
        label={say(words.amount)}
        name='amount'
        inputMode='numeric'
        autoComplete='off'
        required
        defaultValue={String(owed)}
        description={say(texts.amountDescription(amountOf(owed, currency)))}
        error={said.errors['amount']}
      />
      {method !== undefined && takesCard(method) && (
        <FieldRow>
          <TextField
            label={say(texts.cardLastFour)}
            name='cardLastFour'
            inputMode='numeric'
            autoComplete='off'
            maxLength={4}
            description={say(texts.cardLastFourDescription)}
            error={said.errors['cardLastFour']}
          />
          <TextField
            label={say(texts.cardBrand)}
            name='cardBrand'
            autoComplete='off'
            maxLength={50}
            description={say(texts.cardBrandDescription)}
            error={said.errors['cardBrand']}
          />
        </FieldRow>
      )}
    </Form>
  )
}
