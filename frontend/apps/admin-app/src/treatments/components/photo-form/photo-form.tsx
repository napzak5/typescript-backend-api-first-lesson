import { upTo, WEB_ADDRESS_DESCRIPTION } from '@beauty-salon-frontend/fields'
import {
  Button,
  Checkbox,
  FieldRow,
  Form,
  type FormErrors,
  FormRow,
  NO_ERRORS,
  Note,
  Select,
  TextArea,
  TextField,
  useRepeatedRows,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import {
  LONGEST_ANGLE,
  PHOTO_TYPE_CHOICES,
  photoControlOf,
} from '../../utils/treatment-photos'
import styles from './photo-form.module.css'

const WORDS = adminTreatmentMessages.photos.form

export type PhotoFormProps = {
  /** How many photos the record can still take: the form offers no more rows */
  room: number
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /**
   * What is wrong with the values, under the names of the controls: a
   * photo's under `photos.<n>.<name>`. A new object is the answer to
   * another attempt
   */
  errors?: FormErrors<LocalizedText> | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/**
 * The photos to add to a treatment record, a group of controls each: when
 * it was taken, the address it is kept at (and that of a smaller one), the
 * angle, what it shows, and how the customer lets it be used. The API
 * keeps the address of a photo, not its file: the photo is put where the
 * salon keeps its photos first.
 *
 * The form opens with one photo. A photo is added at the end and its first
 * control takes the focus; one that is taken away gives the focus to the
 * button that adds one. An error names a row by its number, and taking a
 * row away renumbers the rows after it: the errors of the rows are shown
 * until a row is taken away, and again after the next attempt.
 */
export const PhotoForm = ({
  room,
  message,
  errors = NO_ERRORS,
  pending,
  actions,
  onSubmit,
}: PhotoFormProps) => {
  const say = useSay()
  const choicesOf = useSaidChoices()
  const said = useSaidForm(message, errors)
  // A row of a photo holds nothing but its controls
  const photos = useRepeatedRows<null, LocalizedText>(() => [null], errors)
  const rowErrors = useSaidForm(undefined, photos.errors).errors

  return (
    <Form
      submitLabel={say(WORDS.submit)}
      message={said.message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <Note size='small'>{say(WORDS.note)}</Note>
      {photos.rows.map(({ key }, index) => (
        <FormRow
          key={key}
          ref={photos.rowRef(key)}
          label={say(WORDS.photoOf(index + 1))}
        >
          <FieldRow>
            <Select
              label={say(WORDS.type)}
              name={photoControlOf(index, 'photoType')}
              options={choicesOf(PHOTO_TYPE_CHOICES)}
              placeholder={say(WORDS.choose)}
              required
              defaultValue=''
              error={rowErrors[photoControlOf(index, 'photoType')]}
            />
            <TextField
              label={say(WORDS.angle)}
              name={photoControlOf(index, 'angle')}
              autoComplete='off'
              description={say(WORDS.angleDescription(upTo(LONGEST_ANGLE)))}
              error={rowErrors[photoControlOf(index, 'angle')]}
            />
          </FieldRow>
          <TextField
            label={say(WORDS.photoUrl)}
            name={photoControlOf(index, 'photoUrl')}
            type='url'
            autoComplete='off'
            required
            description={say(WEB_ADDRESS_DESCRIPTION)}
            error={rowErrors[photoControlOf(index, 'photoUrl')]}
          />
          <TextField
            label={say(WORDS.thumbnailUrl)}
            name={photoControlOf(index, 'thumbnailUrl')}
            type='url'
            autoComplete='off'
            description={say(WORDS.thumbnailUrlDescription)}
            error={rowErrors[photoControlOf(index, 'thumbnailUrl')]}
          />
          <TextArea
            label={say(WORDS.description)}
            name={photoControlOf(index, 'description')}
            rows={2}
          />
          <div className={styles['choices']}>
            <Checkbox
              label={say(WORDS.consent)}
              name={photoControlOf(index, 'customerConsent')}
            />
            <Checkbox
              label={say(WORDS.public)}
              name={photoControlOf(index, 'isPublic')}
              description={say(WORDS.publicDescription)}
              error={rowErrors[photoControlOf(index, 'isPublic')]}
            />
          </div>
          {photos.rows.length > 1 && (
            <Button
              size='small'
              aria-label={say(WORDS.removeRow(index + 1))}
              onClick={() => photos.remove(key)}
            >
              {say(WORDS.remove)}
            </Button>
          )}
        </FormRow>
      ))}
      {photos.rows.length < room ? (
        <Button ref={photos.addRef} onClick={() => photos.add(null)}>
          {say(WORDS.addRow)}
        </Button>
      ) : (
        <Note size='small'>{say(WORDS.room(room))}</Note>
      )}
    </Form>
  )
}
