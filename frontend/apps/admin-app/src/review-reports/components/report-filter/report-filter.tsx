import { Button, Select } from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { REPORTS_SHOWN, type ReportsShown, SHOWN } from '../../review-reports'
import styles from './report-filter.module.css'

export type ReportFilterProps = {
  /** The reports that are shown: those of the address */
  shown: ReportsShown
  /** Called with the values of the control when the form is sent */
  onSubmit: (values: FormData) => void
}

/**
 * Which reports the list shows: those that wait for the platform, those
 * it dismissed, or all of them. Like the other filters, it mirrors the
 * address: the control shows what the address asks for whenever that
 * changes, and what was chosen until the form is sent.
 */
export const ReportFilter = ({ shown, onSubmit }: ReportFilterProps) => {
  const [held, setHeld] = useState<{ shown: ReportsShown; value: string }>({
    shown,
    value: shown,
  })
  if (held.shown !== shown) {
    setHeld({ shown, value: shown })
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(new FormData(event.currentTarget))
  }

  return (
    <search aria-label='通報を絞り込む'>
      <form className={styles['form']} noValidate onSubmit={submit}>
        <Select
          label='状態'
          name={SHOWN}
          options={REPORTS_SHOWN}
          value={held.value}
          onChange={(event) => setHeld({ shown, value: event.target.value })}
        />
        <div className={styles['actions']}>
          <Button type='submit' variant='primary'>
            表示する
          </Button>
        </div>
      </form>
    </search>
  )
}
