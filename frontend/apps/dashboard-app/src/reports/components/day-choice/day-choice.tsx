import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  type FormErrors,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import styles from './day-choice.module.css'

export type DayChoiceProps = {
  /** The day that is shown: that of the address */
  day: string
  /** What is wrong with the day that was sent */
  errors?: FormErrors | undefined
  /** Called with the values of the form when it is sent */
  onSubmit: (values: FormData) => void
}

const NO_ERRORS: FormErrors = {}

/**
 * The day whose sales are shown. Like the period of the reports, it
 * mirrors the address: when that changes under it (the day before or
 * after), the field shows the other day.
 */
export const DayChoice = ({
  day,
  errors = NO_ERRORS,
  onSubmit,
}: DayChoiceProps) => {
  const form = useErrorFocus(errors)
  const [shown, setShown] = useState({ day, value: day })
  if (shown.day !== day) {
    setShown({ day, value: day })
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(new FormData(event.currentTarget))
  }

  return (
    <form
      className={styles['form']}
      aria-label='売上を見る日'
      noValidate
      onSubmit={submit}
      ref={form}
    >
      <TextField
        label='日付'
        name='date'
        type='date'
        min={EARLIEST_DAY}
        max={LATEST_DAY}
        required
        description='会計した日（サロンの日付）で数えます。'
        value={shown.value}
        error={errors['date']}
        onChange={(event) => setShown({ day, value: event.target.value })}
      />
      <div className={styles['actions']}>
        <Button type='submit'>表示する</Button>
      </div>
    </form>
  )
}
