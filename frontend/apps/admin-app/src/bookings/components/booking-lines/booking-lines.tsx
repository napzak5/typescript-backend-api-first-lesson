import type {
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Button,
  type FormErrors,
  Select,
  TextField,
} from '@beauty-salon-frontend/ui'
import { useLayoutEffect, useRef, useState } from 'react'
import {
  lineControlOf,
  MOST_LINES,
  NO_STAFF,
  SAME_STAFF,
} from '../../booking-entry'
import type { LineCheck } from '../../bookings-api'
import { LineCheckNote } from '../line-check-note/line-check-note'
import styles from './booking-lines.module.css'

export type BookingLinesProps = {
  /** The members of the staff of the salon */
  staff: readonly ModelsStaffProfileResponse[]
  /** The services of the salon, those it does not take bookings for as well */
  services: readonly ModelsServiceResponse[]
  /**
   * What is wrong with a value, under the name of its control
   * (`services.1.startTime`). A new object is the answer to another attempt
   */
  errors: FormErrors
  /** What was found out about the member of each line, row by row; `undefined` while nothing is */
  checks?: readonly LineCheck[] | undefined
  /** The time zone of the salon: the overlapping bookings are said on its clock */
  timezone: string
  /** A row was added or taken away: what was found out about the rows is out of date */
  onRowsChange: () => void
}

/** What a press did to the rows, until the focus has followed it */
type Change = 'added' | 'removed' | undefined

/** The services a line is for, by name and length; one the salon takes no bookings for says so. */
export const serviceOptionsOf = (services: readonly ModelsServiceResponse[]) =>
  services.map(({ id, name, duration, isActive }) => ({
    value: id,
    label: `${name}（${duration} 分）${isActive ? '' : '（受付停止中）'}`,
  }))

/** Who does a line: the member of the booking, a member of the staff, or nobody. */
export const staffOptionsOf = (
  staff: readonly ModelsStaffProfileResponse[],
) => [
  { value: SAME_STAFF, label: '予約の担当と同じ' },
  ...staff.map(({ id, displayName }) => ({ value: id, label: displayName })),
  { value: NO_STAFF, label: '決めない' },
]

/**
 * The lines of a booking, a row each, with the buttons that add a row and
 * take one away: from one line to twenty. A line is a service, the member
 * of the staff who does it (the member of the booking at first), the time
 * it begins on the day of the visit, and a note. The browser keeps the
 * values; the component keeps which rows there are.
 *
 * The focus follows a press: to the first control of a row that was added,
 * to the button that adds a row after one was taken away. Taking a row away
 * renumbers the rows after it, so the errors of the attempt are shown no
 * longer, and what was found out about the rows is out of date.
 */
export const BookingLines = ({
  staff,
  services,
  errors,
  checks,
  timezone,
  onRowsChange,
}: BookingLinesProps) => {
  const [rows, setRows] = useState<number[]>([0])
  const [outdated, setOutdated] = useState<FormErrors | undefined>(undefined)
  const nextKey = useRef(1)
  const change = useRef<Change>(undefined)
  const list = useRef<HTMLOListElement>(null)
  const adding = useRef<HTMLButtonElement>(null)
  const said = errors === outdated ? {} : errors
  const serviceOptions = serviceOptionsOf(services)
  const staffOptions = staffOptionsOf(staff)

  // The focus follows in the commit that shows what the press did. Every
  // other commit finds no change to follow
  useLayoutEffect(() => {
    if (change.current === 'added') {
      list.current?.querySelector<HTMLElement>('li:last-child select')?.focus()
    }
    if (change.current === 'removed') {
      adding.current?.focus()
    }
    change.current = undefined
  })

  const add = (): void => {
    change.current = 'added'
    setRows([...rows, nextKey.current])
    nextKey.current += 1
    onRowsChange()
  }

  const remove = (key: number): void => {
    change.current = 'removed'
    setRows(rows.filter((row) => row !== key))
    setOutdated(errors)
    onRowsChange()
  }

  return (
    <div className={styles['lines']}>
      <ol className={styles['rows']} ref={list}>
        {rows.map((key, index) => {
          const name = `明細 ${index + 1}`
          const check = checks?.[index]

          return (
            <li key={key} className={styles['row']}>
              <Select
                className={styles['wide']}
                label={`${name} のメニュー`}
                name={lineControlOf(index, 'serviceId')}
                options={serviceOptions}
                placeholder='選んでください'
                required
                defaultValue=''
                error={said[lineControlOf(index, 'serviceId')]}
              />
              <Select
                label={`${name} の担当`}
                name={lineControlOf(index, 'staffId')}
                options={staffOptions}
                defaultValue={SAME_STAFF}
                error={said[lineControlOf(index, 'staffId')]}
              />
              <TextField
                label={`${name} の開始`}
                name={lineControlOf(index, 'startTime')}
                autoComplete='off'
                type='time'
                required
                error={said[lineControlOf(index, 'startTime')]}
              />
              <TextField
                className={styles['wide']}
                label={`${name} のメモ`}
                name={lineControlOf(index, 'notes')}
                autoComplete='off'
                error={said[lineControlOf(index, 'notes')]}
              />
              {check !== undefined && (
                <LineCheckNote
                  check={check}
                  timezone={timezone}
                  className={styles['check']}
                />
              )}
              {rows.length > 1 && (
                <Button
                  size='small'
                  className={styles['remove']}
                  onClick={() => remove(key)}
                >
                  {`${name} を外す`}
                </Button>
              )}
            </li>
          )
        })}
      </ol>
      {rows.length < MOST_LINES ? (
        <Button ref={adding} onClick={add}>
          明細を追加する
        </Button>
      ) : (
        <p>明細は {MOST_LINES} までです。</p>
      )}
    </div>
  )
}
