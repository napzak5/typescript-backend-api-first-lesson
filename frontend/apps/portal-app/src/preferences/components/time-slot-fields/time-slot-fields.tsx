import type { ModelsTimeSlot } from '@beauty-salon-frontend/api-client'
import { Button, type FormErrors, TextField } from '@beauty-salon-frontend/ui'
import { useLayoutEffect, useRef, useState } from 'react'
import { endOf, startOf } from '../../preferences-flow'
import styles from './time-slot-fields.module.css'

export type TimeSlotFieldsProps = {
  /**
   * The name of the list. The controls of the row of the number `n`,
   * counted from 0, are named `<name>.<n>.startTime` and `<name>.<n>.endTime`
   */
  name: string
  /** The time slots the rows open with */
  defaultValue: readonly ModelsTimeSlot[]
  /**
   * What is wrong with a time, under the name of its control. A new object
   * is the answer to another attempt
   */
  errors: FormErrors
}

type Row = {
  /** Stays with the row while others come and go: the browser keeps what was typed into it */
  key: number
  /** What the row opened with; a row that was added opened empty */
  slot: ModelsTimeSlot | undefined
}

/** What a press did to the rows, until the focus has followed it */
type Change = 'added' | 'removed' | undefined

/**
 * The time slots of a form, a row each, with the buttons that add a row
 * and take one away. The browser keeps the times, as it does for every
 * control of a form: the component keeps which rows there are.
 *
 * The focus follows a press. A row that was added takes it at its first
 * time; a row that was taken away took its button with it, and the focus
 * goes to the button that adds a row, which is always there.
 *
 * An error names a row by its number, and taking a row away renumbers the
 * rows after it. The errors of an attempt are therefore shown until a row
 * is taken away, and again after the next attempt.
 */
export const TimeSlotFields = ({
  name,
  defaultValue,
  errors,
}: TimeSlotFieldsProps) => {
  const [rows, setRows] = useState<Row[]>(() =>
    defaultValue.map((slot, key) => ({ key, slot })),
  )
  const [outdated, setOutdated] = useState<FormErrors | undefined>(undefined)
  const nextKey = useRef(defaultValue.length)
  const change = useRef<Change>(undefined)
  const list = useRef<HTMLOListElement>(null)
  const adding = useRef<HTMLButtonElement>(null)
  const said = errors === outdated ? {} : errors

  // The focus follows in the commit that shows what the press did. Every
  // other commit finds no change to follow
  useLayoutEffect(() => {
    if (change.current === 'added') {
      list.current?.querySelector<HTMLElement>('li:last-child input')?.focus()
    }
    if (change.current === 'removed') {
      adding.current?.focus()
    }
    change.current = undefined
  })

  const add = (): void => {
    change.current = 'added'
    setRows([...rows, { key: nextKey.current, slot: undefined }])
    nextKey.current += 1
  }

  const remove = (key: number): void => {
    change.current = 'removed'
    setRows(rows.filter((row) => row.key !== key))
    setOutdated(errors)
  }

  return (
    <div className={styles['slots']}>
      {rows.length > 0 && (
        <ol className={styles['rows']} ref={list}>
          {rows.map((row, index) => (
            <li key={row.key} className={styles['row']}>
              <TextField
                label={`時間帯 ${index + 1} の開始`}
                name={startOf(name, index)}
                type='time'
                defaultValue={row.slot?.startTime}
                error={said[startOf(name, index)]}
              />
              <TextField
                label={`時間帯 ${index + 1} の終了`}
                name={endOf(name, index)}
                type='time'
                defaultValue={row.slot?.endTime}
                error={said[endOf(name, index)]}
              />
              <Button
                size='small'
                className={styles['remove']}
                onClick={() => remove(row.key)}
              >
                {`時間帯 ${index + 1} を削除する`}
              </Button>
            </li>
          ))}
        </ol>
      )}
      <Button ref={adding} className={styles['add']} onClick={add}>
        時間帯を追加する
      </Button>
    </div>
  )
}
