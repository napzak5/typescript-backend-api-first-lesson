import { LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  Alert,
  Checkbox,
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  RadioGroup,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useState } from 'react'
import {
  kindNameOf,
  type OfferedSale,
  type PointKind,
} from '../../utils/points'
import styles from './point-entry-form.module.css'

const { form: words } = adminCustomerMessages.points

export type PointEntryFormProps = Pick<
  FormProps,
  'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /**
   * The errors of the controls, under their names. A new object is a new
   * attempt: the focus goes to the first control with an error
   */
  errors?: FormErrors<LocalizedText> | undefined
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
  message,
  errors = NO_ERRORS,
  ...form
}: PointEntryFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const [kind, setKind] = useState(initialKind)

  return (
    <div className={styles['entry']}>
      {sale?.type === 'unusable' && (
        <Alert tone='warning'>{say(sale.why)}</Alert>
      )}
      <Form
        {...form}
        message={said.message}
        errors={errors}
        submitLabel={say(words.record)}
      >
        <RadioGroup
          label={say(words.kind)}
          name='kind'
          required
          options={kinds.map((one) => ({
            value: one,
            label: say(kindNameOf(one)),
          }))}
          value={kind}
          onChange={(event) => {
            const chosen = kinds.find((one) => one === event.target.value)
            if (chosen !== undefined) {
              setKind(chosen)
            }
          }}
          error={said.errors['kind']}
        />
        <TextField
          width='short'
          label={say(words.points)}
          name='points'
          inputMode='numeric'
          autoComplete='off'
          required
          description={say(words.pointsDescription(balance))}
          error={said.errors['points']}
        />
        {kind === 'earned' && (
          <TextField
            width='short'
            label={say(words.expiryDate)}
            name='expiryDate'
            autoComplete='off'
            type='date'
            min={today}
            max={LATEST_DAY}
            description={say(words.expiryDescription)}
            error={said.errors['expiryDate']}
          />
        )}
        <TextArea
          label={say(words.description)}
          name='description'
          rows={2}
          description={say(words.descriptionDescription)}
          error={said.errors['description']}
        />
        {sale?.type === 'sale' && (
          <Checkbox
            name='saleId'
            value={sale.id}
            defaultChecked
            label={say(words.forSale(sale.name))}
            description={say(words.forSaleDescription)}
          />
        )}
      </Form>
    </div>
  )
}
