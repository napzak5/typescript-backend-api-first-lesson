import type { ModelsBookingResponse } from '@beauty-salon-frontend/api-client'
import {
  FieldRow,
  type FormErrors,
  type NamedChoice,
  Select,
  TextArea,
  TextField,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { SOURCES, sourceNameOf } from '../../utils/booking-entry'
import styles from './booking-notes-fields.module.css'

const { notes: WORDS } = adminBookingMessages.entry

export type BookingNotesFieldsProps = {
  /** What the booking has written down: the controls open with it. Nothing for a new booking */
  notes?:
    | Pick<
        ModelsBookingResponse,
        'depositAmount' | 'customerRequest' | 'internalNotes' | 'source'
      >
    | undefined
  /** What is wrong with a value, under the name of its control. A new object is the answer to another attempt */
  errors: FormErrors<LocalizedText>
}

/** The ways the form offers, and a stored one it does not (a booking of the portal: `online`) */
const sourceOptionsOf = (stored: string | null): NamedChoice[] => [
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
}: BookingNotesFieldsProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(undefined, errors)

  return (
    <div className={styles['fields']}>
      <FieldRow>
        <Select
          label={say(WORDS.source)}
          name='source'
          options={options(sourceOptionsOf(notes?.source ?? null))}
          placeholder={say(WORDS.noSource)}
          defaultValue={notes?.source ?? ''}
          error={said.errors['source']}
        />
        <TextField
          label={say(WORDS.deposit)}
          name='depositAmount'
          inputMode='numeric'
          autoComplete='off'
          defaultValue={notes?.depositAmount?.toString() ?? ''}
          description={say(WORDS.depositDescription)}
          error={said.errors['depositAmount']}
        />
      </FieldRow>
      <TextArea
        label={say(WORDS.customerRequest)}
        name='customerRequest'
        rows={4}
        defaultValue={notes?.customerRequest ?? ''}
        error={said.errors['customerRequest']}
      />
      <TextArea
        label={say(WORDS.internalNotes)}
        name='internalNotes'
        rows={4}
        defaultValue={notes?.internalNotes ?? ''}
        description={say(WORDS.internalNotesDescription)}
        error={said.errors['internalNotes']}
      />
    </div>
  )
}
