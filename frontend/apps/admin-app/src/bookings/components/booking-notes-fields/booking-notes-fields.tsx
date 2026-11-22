import type { ModelsBookingResponse } from '@beauty-salon-frontend/api-client'
import {
  FieldRow,
  type FormErrors,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { SOURCES, sourceNameOf } from '../../utils/booking-entry'
import styles from './booking-notes-fields.module.css'

export type BookingNotesFieldsProps = {
  /** What the booking has written down: the controls open with it. Nothing for a new booking */
  notes?:
    | Pick<
        ModelsBookingResponse,
        'depositAmount' | 'customerRequest' | 'internalNotes' | 'source'
      >
    | undefined
  /** What is wrong with a value, under the name of its control */
  errors: FormErrors
}

/** The ways the form offers, and a stored one it does not (a booking of the portal: `online`) */
const sourceOptionsOf = (stored: string | null) => [
  ...SOURCES,
  ...(stored === null || SOURCES.some(({ value }) => value === stored)
    ? []
    : [{ value: stored, label: sourceNameOf(stored) }]),
]

/**
 * What the salon writes down on a booking beside who comes when: how it
 * reached the salon, the deposit, what the customer asked for and the note
 * of the salon. The form that puts a booking in has them, and the one that
 * changes them.
 */
export const BookingNotesFields = ({
  notes,
  errors,
}: BookingNotesFieldsProps) => (
  <div className={styles['fields']}>
    <FieldRow>
      <Select
        label='受付の経路'
        name='source'
        options={sourceOptionsOf(notes?.source ?? null)}
        placeholder='記録しない'
        defaultValue={notes?.source ?? ''}
        error={errors['source']}
      />
      <TextField
        label='予約金'
        name='depositAmount'
        inputMode='numeric'
        autoComplete='off'
        defaultValue={notes?.depositAmount?.toString() ?? ''}
        description='お預かりした円の金額。お預かりしていなければ空欄です。'
        error={errors['depositAmount']}
      />
    </FieldRow>
    <TextArea
      label='お客様の要望'
      name='customerRequest'
      rows={4}
      defaultValue={notes?.customerRequest ?? ''}
      error={errors['customerRequest']}
    />
    <TextArea
      label='サロン内のメモ'
      name='internalNotes'
      rows={4}
      defaultValue={notes?.internalNotes ?? ''}
      description='お客様には見えません。'
      error={errors['internalNotes']}
    />
  </div>
)
