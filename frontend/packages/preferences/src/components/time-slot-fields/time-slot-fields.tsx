import type { ModelsTimeSlot } from '@beauty-salon-frontend/api-client'
import {
  Button,
  type FormErrors,
  TextField,
  useRepeatedRows,
} from '@beauty-salon-frontend/ui'
import { endOf, startOf } from '../../utils/preferences-flow'
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
  // A row holds the time slot it opened with; a row that was added opened empty
  const slots = useRepeatedRows<ModelsTimeSlot | undefined>(
    () => defaultValue,
    errors,
  )

  return (
    <div className={styles['slots']}>
      {slots.rows.length > 0 && (
        <ol className={styles['rows']}>
          {slots.rows.map((row, index) => (
            <li
              key={row.key}
              ref={slots.rowRef(row.key)}
              className={styles['row']}
            >
              <TextField
                label={`時間帯 ${index + 1} の開始`}
                name={startOf(name, index)}
                autoComplete='off'
                type='time'
                defaultValue={row.value?.startTime}
                error={slots.errors[startOf(name, index)]}
              />
              <TextField
                label={`時間帯 ${index + 1} の終了`}
                name={endOf(name, index)}
                autoComplete='off'
                type='time'
                defaultValue={row.value?.endTime}
                error={slots.errors[endOf(name, index)]}
              />
              <Button
                size='small'
                className={styles['remove']}
                onClick={() => slots.remove(row.key)}
              >
                {`時間帯 ${index + 1} を削除する`}
              </Button>
            </li>
          ))}
        </ol>
      )}
      <Button ref={slots.addRef} onClick={() => slots.add(undefined)}>
        時間帯を追加する
      </Button>
    </div>
  )
}
