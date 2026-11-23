import type { ModelsPaymentMethodResponse } from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import {
  FieldRow,
  Form,
  type FormProps,
  inJapanese,
  RadioGroup,
  TextField,
} from '@beauty-salon-frontend/ui'
import { useState } from 'react'
import { methodLabelOf, takesCard } from '../../utils/payments'

export type PaymentFormProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
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
  errors = {},
  ...form
}: PaymentFormProps) => {
  const [chosen, setChosen] = useState('')
  const method = methods.find(({ id }) => id === chosen)

  return (
    <Form {...form} errors={errors} submitLabel='支払いを記録する'>
      <RadioGroup
        label='支払い方法'
        name='paymentMethodId'
        required
        options={methods.map((one) => ({
          value: one.id,
          label: methodLabelOf(one, currency),
        }))}
        value={chosen}
        onChange={(event) => setChosen(event.target.value)}
        description='括弧の中は、1 回に受け付ける金額です。'
        error={errors['paymentMethodId']}
      />
      <TextField
        width='short'
        label='金額'
        name='amount'
        inputMode='numeric'
        autoComplete='off'
        required
        defaultValue={String(owed)}
        description={`円の整数で入れます。未払い残額は${inJapanese(amountOf(owed, currency))}です。分けて受け取るときは、受け取った分を入れます。`}
        error={errors['amount']}
      />
      {method !== undefined && takesCard(method) && (
        <FieldRow>
          <TextField
            label='カードの下 4 桁'
            name='cardLastFour'
            inputMode='numeric'
            autoComplete='off'
            maxLength={4}
            description='わかるときだけ入れます。カードの番号そのものは入れません。'
            error={errors['cardLastFour']}
          />
          <TextField
            label='カードのブランド'
            name='cardBrand'
            autoComplete='off'
            maxLength={50}
            description='わかるときだけ入れます（VISA、Mastercard、JCB など）。'
            error={errors['cardBrand']}
          />
        </FieldRow>
      )}
    </Form>
  )
}
