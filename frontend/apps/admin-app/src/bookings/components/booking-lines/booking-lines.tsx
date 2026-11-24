import type {
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Button,
  type FormErrors,
  type NamedChoice,
  Select,
  TextField,
  useRepeatedRows,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import {
  adminBookingMessages,
  adminStaffMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import type { LineCheck } from '../../api/bookings-api'
import {
  lineControlOf,
  MOST_LINES,
  NO_STAFF,
  SAME_STAFF,
} from '../../utils/booking-entry'
import { LineCheckNote } from '../line-check-note/line-check-note'
import styles from './booking-lines.module.css'

const { lines: WORDS } = adminBookingMessages.entry

export type BookingLinesProps = {
  /** The members of the staff of the salon */
  staff: readonly ModelsStaffProfileResponse[]
  /** The services of the salon, those it does not take bookings for as well */
  services: readonly ModelsServiceResponse[]
  /**
   * What is wrong with a value, under the name of its control
   * (`services.1.startTime`). A new object is the answer to another attempt
   */
  errors: FormErrors<LocalizedText>
  /** What was found out about the member of each line, row by row; `undefined` while nothing is */
  checks?: readonly LineCheck[] | undefined
  /** The time zone of the salon: the overlapping bookings are said on its clock */
  timezone: string
  /** A row was added or taken away: what was found out about the rows is out of date */
  onRowsChange: () => void
}

/** The services a line is for, by name and length; one the salon takes no bookings for says so. */
export const serviceOptionsOf = (
  services: readonly ModelsServiceResponse[],
): NamedChoice[] =>
  services.map(({ id, name, duration, isActive }) => ({
    value: id,
    label: WORDS.serviceChoice(name, formats.minutesOf(duration), isActive),
  }))

/** Who does a line: the member of the booking, a member of the staff, or nobody. */
export const staffOptionsOf = (
  staff: readonly ModelsStaffProfileResponse[],
): NamedChoice[] => [
  { value: SAME_STAFF, label: WORDS.sameStaff },
  ...staff.map(({ id, displayName }) => ({
    value: id,
    label: adminStaffMessages.named(displayName),
  })),
  { value: NO_STAFF, label: WORDS.noStaff },
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
  const say = useSay()
  const options = useSaidChoices()
  // A line holds nothing but its controls
  const lines = useRepeatedRows<null, LocalizedText>(() => [null], errors)
  const said = useSaidForm(undefined, lines.errors)
  const serviceOptions = options(serviceOptionsOf(services))
  const staffOptions = options(staffOptionsOf(staff))

  const add = (): void => {
    lines.add(null)
    onRowsChange()
  }

  const remove = (key: number): void => {
    lines.remove(key)
    onRowsChange()
  }

  return (
    <div className={styles['lines']}>
      <ol className={styles['rows']}>
        {lines.rows.map(({ key }, index) => {
          const number = index + 1
          const check = checks?.[index]

          return (
            <li key={key} ref={lines.rowRef(key)} className={styles['row']}>
              <Select
                className={styles['wide']}
                label={say(WORDS.serviceOf(number))}
                name={lineControlOf(index, 'serviceId')}
                options={serviceOptions}
                placeholder={say(adminBookingMessages.words.choose)}
                required
                defaultValue=''
                error={said.errors[lineControlOf(index, 'serviceId')]}
              />
              <Select
                label={say(WORDS.staffOf(number))}
                name={lineControlOf(index, 'staffId')}
                options={staffOptions}
                defaultValue={SAME_STAFF}
                error={said.errors[lineControlOf(index, 'staffId')]}
              />
              <TextField
                label={say(WORDS.startOf(number))}
                name={lineControlOf(index, 'startTime')}
                autoComplete='off'
                type='time'
                required
                error={said.errors[lineControlOf(index, 'startTime')]}
              />
              <TextField
                className={styles['wide']}
                label={say(WORDS.notesOf(number))}
                name={lineControlOf(index, 'notes')}
                autoComplete='off'
                error={said.errors[lineControlOf(index, 'notes')]}
              />
              {check !== undefined && (
                <LineCheckNote
                  check={check}
                  timezone={timezone}
                  className={styles['check']}
                />
              )}
              {lines.rows.length > 1 && (
                <Button
                  size='small'
                  className={styles['remove']}
                  onClick={() => remove(key)}
                >
                  {say(WORDS.removeLine(number))}
                </Button>
              )}
            </li>
          )
        })}
      </ol>
      {lines.rows.length < MOST_LINES ? (
        <Button ref={lines.addRef} onClick={add}>
          {say(WORDS.add)}
        </Button>
      ) : (
        <p>{say(WORDS.most(formats.numberOf(MOST_LINES)))}</p>
      )}
    </div>
  )
}
