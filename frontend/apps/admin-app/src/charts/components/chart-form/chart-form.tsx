import type {
  ModelsMedicalChartResponse,
  ModelsPreviousTreatment,
} from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY } from '@beauty-salon-frontend/fields'
import {
  Button,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
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
import { adminChartMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import { tagsTextOf } from '../../../customers/utils/customer-ledger'
import {
  MOST_TREATMENTS,
  rowControlOf,
  TREATMENT_CHOICES,
} from '../../utils/chart-form'

const { form: FORM, words } = adminChartMessages

export type ChartFormProps = {
  /** The chart the form opens with; none for one that is made */
  chart?: ModelsMedicalChartResponse | undefined
  /** Today at the salon: the last day a treatment was had on */
  today: string
  submitLabel: string
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /**
   * What is wrong with the values, under the names of the controls; a
   * row's under `previousTreatments.<n>.<name>`. A new object is the
   * answer to another attempt
   */
  errors?: FormErrors<LocalizedText> | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/**
 * The chart of a customer: what to take care of before a treatment, the
 * products they like and those to avoid, the notes, and the treatments
 * they had before, each a group of its own. A treatment is added at the
 * end, and its first control takes the focus; one that is taken away
 * gives the focus to the button that adds one. The browser keeps the
 * values of a row, so the rows that stay keep what was written in them.
 *
 * An error names a row by its number, and taking a row away renumbers the
 * rows after it. The errors of the rows are therefore shown until a row is
 * taken away, and again after the next attempt.
 */
export const ChartForm = ({
  chart,
  today,
  submitLabel,
  message,
  errors = NO_ERRORS,
  pending,
  actions,
  onSubmit,
}: ChartFormProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(message, errors)
  // A row of the treatments the customer had before holds what it opened
  // with, if anything
  const treatments = useRepeatedRows<
    ModelsPreviousTreatment | undefined,
    LocalizedText
  >(() => chart?.previousTreatments ?? [], errors)
  const rowErrors = useSaidForm(undefined, treatments.errors).errors

  return (
    <Form
      submitLabel={submitLabel}
      message={said.message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <FormPart label={say(FORM.beforeTreatment)}>
        <TextArea
          label={say(words.medicalConditions)}
          name='medicalConditions'
          description={say(FORM.medicalConditionsDescription)}
          defaultValue={chart?.medicalConditions ?? undefined}
          error={said.errors['medicalConditions']}
        />
        <TextField
          label={say(words.preferredProducts)}
          name='preferredProducts'
          autoComplete='off'
          description={say(FORM.preferredProductsDescription)}
          defaultValue={say(tagsTextOf(chart?.preferredProducts ?? []))}
          error={said.errors['preferredProducts']}
        />
        <TextField
          label={say(words.avoidProducts)}
          name='avoidProducts'
          autoComplete='off'
          description={say(FORM.avoidProductsDescription)}
          defaultValue={say(tagsTextOf(chart?.avoidProducts ?? []))}
          error={said.errors['avoidProducts']}
        />
      </FormPart>
      <FormPart
        label={say(words.previousTreatments)}
        description={say(FORM.previousTreatmentsDescription)}
      >
        {treatments.rows.map((row, index) => (
          <FormRow
            key={row.key}
            ref={treatments.rowRef(row.key)}
            label={say(FORM.row(index + 1))}
          >
            <FieldRow>
              <Select
                label={say(words.treatment)}
                name={rowControlOf(index, 'treatment')}
                options={options(TREATMENT_CHOICES)}
                placeholder={say(FORM.choose)}
                required
                defaultValue={row.value?.treatment ?? ''}
                error={rowErrors[rowControlOf(index, 'treatment')]}
              />
              <TextField
                label={say(words.date)}
                name={rowControlOf(index, 'date')}
                autoComplete='off'
                type='date'
                required
                min={EARLIEST_DAY}
                max={today}
                defaultValue={row.value?.date}
                error={rowErrors[rowControlOf(index, 'date')]}
              />
            </FieldRow>
            <TextField
              label={say(words.salonName)}
              name={rowControlOf(index, 'salonName')}
              autoComplete='off'
              description={say(FORM.salonNameDescription)}
              defaultValue={row.value?.salonName ?? undefined}
              error={rowErrors[rowControlOf(index, 'salonName')]}
            />
            <TextArea
              label={say(FORM.treatmentNotes)}
              name={rowControlOf(index, 'notes')}
              rows={2}
              defaultValue={row.value?.notes ?? undefined}
            />
            <Button
              size='small'
              aria-label={say(FORM.removeRow(index + 1))}
              onClick={() => treatments.remove(row.key)}
            >
              {say(FORM.remove)}
            </Button>
          </FormRow>
        ))}
        {treatments.rows.length < MOST_TREATMENTS ? (
          <Button
            ref={treatments.addRef}
            onClick={() => treatments.add(undefined)}
          >
            {say(FORM.addRow)}
          </Button>
        ) : (
          <Note size='small'>{say(FORM.mostRows(MOST_TREATMENTS))}</Note>
        )}
      </FormPart>
      <TextArea
        label={say(words.notes)}
        name='notes'
        defaultValue={chart?.notes ?? undefined}
        error={said.errors['notes']}
      />
    </Form>
  )
}
