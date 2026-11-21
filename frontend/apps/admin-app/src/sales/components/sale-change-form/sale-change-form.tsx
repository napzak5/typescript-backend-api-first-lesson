import type {
  ModelsSaleResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/salon-screens'
import {
  FieldRow,
  Form,
  type FormProps,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { NO_CASHIER } from '../../checkout'
import { saleMomentOf } from '../../sale-changes'

export type SaleChangeFormProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The sale as it is: what the form opens with */
  sale: Pick<ModelsSaleResponse, 'staffId' | 'saleTime' | 'notes'>
  /** The members of the staff the payment can have been taken by */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /** The time zone of the salon: the day and the time are those of its clock */
  timezone: string
}

/** What the member of the sale is offered as, who is not among the staff now */
const UNLISTED = '一覧にないスタッフ（いまの担当）'

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
  errors = {},
  ...form
}: SaleChangeFormProps) => {
  const { date, time } = saleMomentOf(sale.saleTime, timezone)
  const unlisted =
    sale.staffId !== null && !staff.some(({ id }) => id === sale.staffId)
      ? [{ value: sale.staffId, label: UNLISTED }]
      : []

  return (
    <Form {...form} errors={errors} submitLabel='変更を保存する'>
      <Select
        label='会計の担当'
        name='staffId'
        options={[
          ...staff.map(({ id, displayName }) => ({
            value: id,
            label: displayName,
          })),
          ...unlisted,
          { value: NO_CASHIER, label: '記録しない' },
        ]}
        defaultValue={sale.staffId ?? NO_CASHIER}
        description='支払いを受けたスタッフです。'
        error={errors['staffId']}
      />
      <FieldRow>
        <TextField
          label='会計日'
          name='saleDate'
          autoComplete='off'
          type='date'
          required
          defaultValue={date}
          min={EARLIEST_DAY}
          max={LATEST_DAY}
          description='サロンの時計の日付です。売上台帳は、この日で売上を探します。'
          error={errors['saleDate']}
        />
        <TextField
          label='会計の時刻'
          name='saleTime'
          autoComplete='off'
          type='time'
          required
          defaultValue={time}
          description='支払いを受けた時刻です。いまより後にはできません。'
          error={errors['saleTime']}
        />
      </FieldRow>
      <TextArea
        label='メモ'
        name='notes'
        defaultValue={sale.notes ?? ''}
        description='サロンの中で見る、この会計のメモです。お客様には見えません。空にすると、メモを消します。'
        error={errors['notes']}
      />
    </Form>
  )
}
