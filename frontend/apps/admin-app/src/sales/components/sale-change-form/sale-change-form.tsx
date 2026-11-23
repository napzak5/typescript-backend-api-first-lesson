import type {
  ModelsSaleResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  FieldRow,
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  Select,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { NO_CASHIER } from '../../utils/checkout'
import { saleMomentOf } from '../../utils/sale-changes'

const { words } = adminSaleMessages
const { change: texts } = adminSaleMessages.changes

export type SaleChangeFormProps = Pick<
  FormProps,
  'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /** The sale as it is: what the form opens with */
  sale: Pick<ModelsSaleResponse, 'staffId' | 'saleTime' | 'notes'>
  /** The members of the staff the payment can have been taken by */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /** The time zone of the salon: the day and the time are those of its clock */
  timezone: string
}

/**
 * What a sale records beside what it bills: who took the payment, when, and
 * the note of the salon. The form opens with what the sale has. A member
 * of the sale who is among the staff no more is offered as such, so that
 * the sale keeps that member when the choice is left as it is.
 */
export const SaleChangeForm = ({
  sale,
  staff,
  timezone,
  message,
  errors = NO_ERRORS,
  ...form
}: SaleChangeFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const { date, time } = saleMomentOf(sale.saleTime, timezone)
  const unlisted =
    sale.staffId !== null && !staff.some(({ id }) => id === sale.staffId)
      ? [{ value: sale.staffId, label: say(texts.unlisted) }]
      : []

  return (
    <Form
      {...form}
      message={said.message}
      errors={errors}
      submitLabel={say(texts.submit)}
    >
      <Select
        label={say(words.cashier)}
        name='staffId'
        options={[
          ...staff.map(({ id, displayName }) => ({
            value: id,
            label: displayName,
          })),
          ...unlisted,
          { value: NO_CASHIER, label: say(words.noCashier) },
        ]}
        defaultValue={sale.staffId ?? NO_CASHIER}
        description={say(texts.cashierDescription)}
        error={said.errors['staffId']}
      />
      <FieldRow>
        <TextField
          label={say(words.saleDate)}
          name='saleDate'
          autoComplete='off'
          type='date'
          required
          defaultValue={date}
          min={EARLIEST_DAY}
          max={LATEST_DAY}
          description={say(texts.saleDateDescription)}
          error={said.errors['saleDate']}
        />
        <TextField
          label={say(texts.saleTime)}
          name='saleTime'
          autoComplete='off'
          type='time'
          required
          defaultValue={time}
          description={say(texts.saleTimeDescription)}
          error={said.errors['saleTime']}
        />
      </FieldRow>
      <TextArea
        label={say(words.notes)}
        name='notes'
        defaultValue={sale.notes ?? ''}
        description={say(texts.notesDescription)}
        error={said.errors['notes']}
      />
    </Form>
  )
}
