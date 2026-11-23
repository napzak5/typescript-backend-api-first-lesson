import { LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  Alert,
  Checkbox,
  Form,
  type FormProps,
  inJapanese,
  RadioGroup,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { useState } from 'react'
import {
  kindNameOf,
  type OfferedSale,
  type PointKind,
} from '../../utils/points'
import styles from './point-entry-form.module.css'

export type PointEntryFormProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What the account may record */
  kinds: readonly PointKind[]
  /** What is chosen at first */
  initialKind: PointKind
  /** The balance of the customer; `undefined` when it could not be read */
  balance: number | undefined
  /** Today at the salon: points given expire no earlier */
  today: string
  /** The sale the address names; `undefined` when it names none */
  sale: OfferedSale | undefined
}

/**
 * Points of a customer: what is recorded, how many, until when the points
 * given can be used, why, and the sale they are recorded for. Every count
 * is positive: the kind says which way the balance moves. The day of
 * expiry is there while points are given.
 */
export const PointEntryForm = ({
  kinds,
  initialKind,
  balance,
  today,
  sale,
  errors = {},
  ...form
}: PointEntryFormProps) => {
  const [kind, setKind] = useState(initialKind)

  return (
    <div className={styles['entry']}>
      {sale?.type === 'unusable' && <Alert tone='warning'>{sale.why}</Alert>}
      <Form {...form} errors={errors} submitLabel='記録する'>
        <RadioGroup
          label='記録すること'
          name='kind'
          required
          options={kinds.map((one) => ({
            value: one,
            label: kindNameOf(one),
          }))}
          value={kind}
          onChange={(event) => {
            const chosen = kinds.find((one) => one === event.target.value)
            if (chosen !== undefined) {
              setKind(chosen)
            }
          }}
          error={errors['kind']}
        />
        <TextField
          width='short'
          label='ポイント数'
          name='points'
          inputMode='numeric'
          autoComplete='off'
          required
          description={`1 以上の整数で入れます。減らすときも、減らす数を入れます。${
            balance === undefined
              ? ''
              : `いまの残高は ${inJapanese(customerMessages.pointsOf(balance))}です。`
          }`}
          error={errors['points']}
        />
        {kind === 'earned' && (
          <TextField
            width='short'
            label='有効期限'
            name='expiryDate'
            autoComplete='off'
            type='date'
            min={today}
            max={LATEST_DAY}
            description='付与したポイントは、この日まで使えます。空のままなら、期限はありません。'
            error={errors['expiryDate']}
          />
        )}
        <TextArea
          label='説明'
          name='description'
          rows={2}
          description='ポイントの履歴に残ります。調整では、理由を書いておきます。'
          error={errors['description']}
        />
        {sale?.type === 'sale' && (
          <Checkbox
            name='saleId'
            value={sale.id}
            defaultChecked
            label={`${sale.name}に結びつける`}
            description='1 つの売上には、ポイントの付与と、使ったポイントの記録を、1 回ずつできます。'
          />
        )}
      </Form>
    </div>
  )
}
