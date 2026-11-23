import type { ModelsCustomerPreferencesResponse } from '@beauty-salon-frontend/api-client'
import { charactersOf } from '@beauty-salon-frontend/fields'
import {
  CheckboxGroup,
  Form,
  FormPart,
  type FormProps,
  inJapanese,
  Note,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import {
  AVOIDED_STAFF,
  AVOIDED_STYLES,
  COMMUNICATION_STYLE,
  enteredOf,
  INSPIRATION_IMAGES,
  MAX_COMMUNICATION_STYLE_LENGTH,
  PREFERRED_COLORS,
  PREFERRED_LENGTH,
  PREFERRED_STAFF,
  SPECIAL_REQUESTS,
  TIME_SLOTS,
} from '../../utils/preferences-flow'
import { type StaffChoice, staffLabelOf } from '../../utils/staff-choices'
import { TimeSlotFields } from '../time-slot-fields/time-slot-fields'
import styles from './preferences-form.module.css'

export type PreferencesFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The preferences the form opens with */
  preferences: ModelsCustomerPreferencesResponse
  /**
   * The members of the staff the form offers. With none of them the form
   * has no control for the staff, and says how to get one
   */
  staff: readonly StaffChoice[]
}

const ONE_A_LINE = '1 行に 1 つずつ書いてください。'

/**
 * What a customer wants the salons to keep in mind, in the parts a person
 * thinks of it in: the staff, the time of a visit, the style, and how they
 * like to be served. A control is named as the property of the request is,
 * and one inside another by its path; the browser keeps the values, and
 * the form hands them over when it is sent.
 *
 * A list that a person writes (colours, styles, the addresses of pictures)
 * is a text with a line for each entry. The staff are chosen from those
 * the form is given, each named with their salon: the preferences are one
 * record for every salon the customer goes to.
 */
export const PreferencesForm = ({
  preferences,
  staff,
  errors = {},
  ...form
}: PreferencesFormProps) => {
  const entered = enteredOf(preferences, staff)
  const options = staff.map((member) => ({
    value: member.id,
    label: staffLabelOf(member),
  }))

  return (
    <Form {...form} errors={errors}>
      <FormPart label='スタッフ'>
        {entered.preferredStaffId === undefined ||
        entered.avoidStaffIds === undefined ? (
          <Note size='small'>
            指名したいスタッフと、避けたいスタッフは、サロンを予約すると選べるようになります。
          </Note>
        ) : (
          <div className={styles['controls']}>
            <Select
              label='指名したいスタッフ'
              name={PREFERRED_STAFF}
              placeholder='指名しない'
              options={options}
              defaultValue={entered.preferredStaffId}
              error={errors[PREFERRED_STAFF]}
            />
            <CheckboxGroup
              label='避けたいスタッフ'
              name={AVOIDED_STAFF}
              options={options}
              defaultValue={entered.avoidStaffIds}
              error={errors[AVOIDED_STAFF]}
            />
          </div>
        )}
      </FormPart>
      <FormPart
        label='希望する時間帯'
        description='来店しやすい時間帯を、いくつでも登録できます。曜日は選べません。'
      >
        <TimeSlotFields
          name={TIME_SLOTS}
          defaultValue={entered.timeSlots}
          errors={errors}
        />
      </FormPart>
      <FormPart label='スタイルの好み'>
        <TextField
          label='希望の長さ'
          name={PREFERRED_LENGTH}
          autoComplete='off'
          defaultValue={entered.preferredLength}
          error={errors[PREFERRED_LENGTH]}
        />
        <TextArea
          label='好きな色'
          name={PREFERRED_COLORS}
          description={ONE_A_LINE}
          defaultValue={entered.preferredColors}
          error={errors[PREFERRED_COLORS]}
        />
        <TextArea
          label='避けたいスタイル'
          name={AVOIDED_STYLES}
          description={ONE_A_LINE}
          defaultValue={entered.avoidStyles}
          error={errors[AVOIDED_STYLES]}
        />
        <TextArea
          label='参考の画像の URL'
          name={INSPIRATION_IMAGES}
          description='参考にしてほしい画像のアドレスを、1 行に 1 つずつ書いてください。'
          defaultValue={entered.inspirationImages}
          error={errors[INSPIRATION_IMAGES]}
        />
      </FormPart>
      <FormPart label='接客'>
        <TextField
          label='接客の好み'
          name={COMMUNICATION_STYLE}
          autoComplete='off'
          description={`会話の多さなどを、${inJapanese(charactersOf(MAX_COMMUNICATION_STYLE_LENGTH))}以内で書いてください。`}
          defaultValue={entered.communicationStyle}
          error={errors[COMMUNICATION_STYLE]}
        />
        <TextArea
          label='特別な要望'
          name={SPECIAL_REQUESTS}
          rows={4}
          defaultValue={entered.specialRequests}
          error={errors[SPECIAL_REQUESTS]}
        />
      </FormPart>
    </Form>
  )
}
