import type {
  ModelsMedicalChartResponse,
  ModelsPreviousTreatment,
} from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY } from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  Note,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { tagsTextOf } from '../../../customers/customer-ledger'
import {
  MOST_TREATMENTS,
  rowControlOf,
  TREATMENT_OPTIONS,
} from '../../chart-form'
import styles from './chart-form.module.css'

export type ChartFormProps = {
  /** The chart the form opens with; none for one that is made */
  chart?: ModelsMedicalChartResponse | undefined
  /** Today at the salon: the last day a treatment was had on */
  today: string
  submitLabel: string
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /**
   * What is wrong with the values, under the names of the controls; a
   * row's under `previousTreatments.<n>.<name>`. A new object is the
   * answer to another attempt
   */
  errors?: FormErrors | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/** A row of the treatments the customer had before: what it opened with, if anything */
type Row = { key: number; shown: ModelsPreviousTreatment | undefined }

/** Where the focus goes after a row was added or taken away */
type Focus = { type: 'row'; key: number } | { type: 'add' } | undefined

const NO_ERRORS: FormErrors = {}

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
  const [rows, setRows] = useState<Row[]>(() =>
    (chart?.previousTreatments ?? []).map((shown, key) => ({ key, shown })),
  )
  const [nextKey, setNextKey] = useState(rows.length)
  const [focus, setFocus] = useState<Focus>()
  const [outdated, setOutdated] = useState<FormErrors | undefined>(undefined)
  const said = errors === outdated ? NO_ERRORS : errors
  const groups = useRef(new Map<number, HTMLFieldSetElement>())
  const add = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (focus?.type === 'row') {
      groups.current.get(focus.key)?.querySelector('select')?.focus()
    }
    if (focus?.type === 'add') {
      add.current?.focus()
    }
  }, [focus])

  const addRow = (): void => {
    setRows([...rows, { key: nextKey, shown: undefined }])
    setNextKey(nextKey + 1)
    setFocus({ type: 'row', key: nextKey })
  }

  const removeRow = (key: number): void => {
    setRows(rows.filter((row) => row.key !== key))
    setOutdated(errors)
    setFocus({ type: 'add' })
  }

  return (
    <Form
      submitLabel={submitLabel}
      message={message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <FormPart label='施術の前に確かめること'>
        <TextArea
          label='持病や体調'
          name='medicalConditions'
          description='施術の前に注意が必要な持病や体調を書きます。'
          defaultValue={chart?.medicalConditions ?? undefined}
          error={errors['medicalConditions']}
        />
        <TextField
          label='好みの商材'
          name='preferredProducts'
          autoComplete='off'
          description='商材やブランドの名前を、「、」か「,」で区切って書きます。'
          defaultValue={tagsTextOf(chart?.preferredProducts ?? [])}
          error={errors['preferredProducts']}
        />
        <TextField
          label='避ける商材'
          name='avoidProducts'
          autoComplete='off'
          description='商材やブランドの名前を、「、」か「,」で区切って書きます。'
          defaultValue={tagsTextOf(chart?.avoidProducts ?? [])}
          error={errors['avoidProducts']}
        />
      </FormPart>
      <FormPart
        label='過去の施術'
        description='ほかのサロンで受けた施術や、カルテを始める前の施術を書きます。'
      >
        {rows.map((row, index) => (
          <fieldset
            key={row.key}
            className={styles['row']}
            ref={(group) => {
              if (group === null) {
                groups.current.delete(row.key)
              } else {
                groups.current.set(row.key, group)
              }
            }}
          >
            <legend className={styles['rowName']}>
              {`${index + 1} 件目の施術`}
            </legend>
            <div className={styles['rowControls']}>
              <FieldRow>
                <Select
                  label='施術'
                  name={rowControlOf(index, 'treatment')}
                  options={TREATMENT_OPTIONS}
                  placeholder='選んでください'
                  required
                  defaultValue={row.shown?.treatment ?? ''}
                  error={said[rowControlOf(index, 'treatment')]}
                />
                <TextField
                  label='施術日'
                  name={rowControlOf(index, 'date')}
                  autoComplete='off'
                  type='date'
                  required
                  min={EARLIEST_DAY}
                  max={today}
                  defaultValue={row.shown?.date}
                  error={said[rowControlOf(index, 'date')]}
                />
              </FieldRow>
              <TextField
                label='サロン'
                name={rowControlOf(index, 'salonName')}
                autoComplete='off'
                description='施術を受けたサロンの名前。分からなければ空のままにします。'
                defaultValue={row.shown?.salonName ?? undefined}
                error={said[rowControlOf(index, 'salonName')]}
              />
              <TextArea
                label='施術のメモ'
                name={rowControlOf(index, 'notes')}
                rows={2}
                defaultValue={row.shown?.notes ?? undefined}
              />
              <Button
                size='small'
                aria-label={`${index + 1} 件目の施術を外す`}
                onClick={() => removeRow(row.key)}
              >
                外す
              </Button>
            </div>
          </fieldset>
        ))}
        {rows.length < MOST_TREATMENTS ? (
          <Button ref={add} onClick={addRow}>
            施術を足す
          </Button>
        ) : (
          <Note size='small'>
            {`過去の施術は、${MOST_TREATMENTS} 件まで書けます。`}
          </Note>
        )}
      </FormPart>
      <TextArea
        label='メモ'
        name='notes'
        defaultValue={chart?.notes ?? undefined}
        error={errors['notes']}
      />
    </Form>
  )
}
