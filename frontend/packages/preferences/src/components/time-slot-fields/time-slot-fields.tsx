import type { ModelsTimeSlot } from '@beauty-salon-frontend/api-client'
import {
  Button,
  type FormErrors,
  TextField,
  useRepeatedRows,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { preferenceMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { endOf, startOf } from '../../utils/preferences-flow'
import styles from './time-slot-fields.module.css'

const { timeSlots: words } = preferenceMessages

export type TimeSlotFieldsProps = {
  /**
   * The name of the list. The controls of the row of the number `n`,
   * counted from 0, are named `<name>.<n>.startTime` and `<name>.<n>.endTime`
   */
  name: string
  /** The time slots the rows open with */
  defaultValue: readonly ModelsTimeSlot[]
  /**
   * What is wrong with a time, under the name of its control, which the
   * component says in the language of the page. A new object is the answer
   * to another attempt
   */
  errors: FormErrors<LocalizedText>
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
  const say = useSay()
  // A row holds the time slot it opened with; a row that was added opened empty
  const slots = useRepeatedRows<ModelsTimeSlot | undefined, LocalizedText>(
    () => defaultValue,
    errors,
  )
  /** What is said at a control */
  const errorAt = (control: string): string | undefined => {
    const error = slots.errors[control]

    return error === undefined ? undefined : say(error)
  }

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
                label={say(words.start(index + 1))}
                name={startOf(name, index)}
                autoComplete='off'
                type='time'
                defaultValue={row.value?.startTime}
                error={errorAt(startOf(name, index))}
              />
              <TextField
                label={say(words.end(index + 1))}
                name={endOf(name, index)}
                autoComplete='off'
                type='time'
                defaultValue={row.value?.endTime}
                error={errorAt(endOf(name, index))}
              />
              <Button
                size='small'
                className={styles['remove']}
                onClick={() => slots.remove(row.key)}
              >
                {say(words.remove(index + 1))}
              </Button>
            </li>
          ))}
        </ol>
      )}
      <Button ref={slots.addRef} onClick={() => slots.add(undefined)}>
        {say(words.add)}
      </Button>
    </div>
  )
}
