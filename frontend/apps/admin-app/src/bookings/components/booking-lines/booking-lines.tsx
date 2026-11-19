import type {
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Badge,
  Button,
  type FormErrors,
  Select,
  TextField,
} from '@beauty-salon-frontend/ui'
import { useLayoutEffect, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import {
  lineControlOf,
  MOST_LINES,
  NO_STAFF,
  SAME_STAFF,
} from '../../booking-entry'
import { hoursOf } from '../../booking-format'
import type { LineCheck } from '../../bookings-api'
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

const serviceOptionsOf = (services: readonly ModelsServiceResponse[]) =>
  services.map(({ id, name, duration, isActive }) => ({
    value: id,
    label: `${name}（${duration} 分）${isActive ? '' : '（受付停止中）'}`,
  }))

const staffOptionsOf = (staff: readonly ModelsStaffProfileResponse[]) => [
  { value: SAME_STAFF, label: '予約の担当と同じ' },
  ...staff.map(({ id, displayName }) => ({ value: id, label: displayName })),
  { value: NO_STAFF, label: '決めない' },
]

type CheckNoteProps = { check: LineCheck; timezone: string }

/** What was found out about the member of a line, with the bookings that overlap it. */
const CheckNote = ({ check, timezone }: CheckNoteProps) =>
  match(check)
    .with({ type: 'unassigned' }, () => (
      <p className={styles['check']}>
        担当を決めない明細は、誰の時間も占有しません。
      </p>
    ))
    .with({ type: 'tooManyRequests' }, { type: 'failed' }, () => (
      <p className={styles['check']}>
        <Badge tone='warning'>空きを確かめられませんでした</Badge>
      </p>
    ))
    .with({ type: 'free' }, { type: 'taken' }, ({ type, overlapping }) => (
      <div className={styles['check']}>
        <p className={styles['verdict']}>
          {type === 'taken' ? (
            <Badge tone='danger'>重なる予約があります</Badge>
          ) : (
            <Badge tone='success'>空いています</Badge>
          )}
          {type === 'free' &&
            overlapping.length > 0 &&
            '（同時に受けられる数の内で、重なる予約があります）'}
        </p>
        {overlapping.length > 0 && (
          <ul className={styles['overlapping']}>
            {overlapping.map((booking) => (
              <li key={booking.id}>
                {`${booking.bookingNumber} ${hoursOf(booking, timezone)}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    ))
    .exhaustive()

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
                type='time'
                required
                error={said[lineControlOf(index, 'startTime')]}
              />
              <TextField
                className={styles['wide']}
                label={`${name} のメモ`}
                name={lineControlOf(index, 'notes')}
                error={said[lineControlOf(index, 'notes')]}
              />
              {check !== undefined && (
                <CheckNote check={check} timezone={timezone} />
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
        <Button ref={adding} className={styles['add']} onClick={add}>
          明細を追加する
        </Button>
      ) : (
        <p>明細は {MOST_LINES} までです。</p>
      )}
    </div>
  )
}
