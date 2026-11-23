import type {
  ModelsBusinessHours,
  ModelsOpeningHours,
} from '@beauty-salon-frontend/api-client'
import { EmptyState, Note, useSay } from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { comingDays, hoursOf, weeklyHoursOf } from '../../utils/salon-format'
import styles from './salon-hours.module.css'

const { hours: words } = portalSalonMessages

export type SalonHoursProps = {
  /** The hours of every week; `null` when the salon registered none */
  businessHours: readonly ModelsBusinessHours[] | null
  /** The hours of single dates, which come before those of the week */
  openingHours: readonly ModelsOpeningHours[]
  /** The time zone of the salon: its dates and times of day are those of this zone */
  timezone: string
  /** The date it is at the salon (`2026-11-19`): the dates before it are left out */
  today: string
}

/** No more dates than a person reads: the calendar of a salon may hold a year */
const MOST_DATES = 14

const remarksOf = (day: ModelsOpeningHours): string =>
  [day.holidayName, day.notes].filter((remark) => remark !== null).join(' ')

/**
 * When a salon is open: the hours of every week, and the dates that have
 * hours of their own (a holiday, a day that ends early).
 *
 * A day and its hours stand side by side at every width, and the hours go
 * on in the next line when they are long (several slots, a break). A table
 * would keep them on one line and scroll on a phone.
 */
export const SalonHours = ({
  businessHours,
  openingHours,
  timezone,
  today,
}: SalonHoursProps) => {
  const say = useSay()
  const dates = comingDays(openingHours, today, MOST_DATES)

  return (
    <div className={styles['hours']}>
      <div className={styles['part']}>
        <h3 className={styles['title']}>{say(words.weekly)}</h3>
        {businessHours === null ? (
          <EmptyState kind='part' title={say(words.noWeekly)} />
        ) : (
          <dl className={styles['days']}>
            {weeklyHoursOf(businessHours, timezone).map((day) => (
              <div key={day.day} className={styles['day']}>
                <dt>{say(day.name)}</dt>
                <dd className={styles['said']}>{say(day.hours)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className={styles['part']}>
        <h3 className={styles['title']}>{say(words.dated)}</h3>
        <Note size='small'>
          {say(dates.length === 0 ? words.noDated : words.datedDescription)}
        </Note>
        {dates.length > 0 && (
          <dl className={styles['days']}>
            {dates.map((day) => (
              <div key={day.date} className={styles['day']}>
                <dt>{say(formats.monthDayOf(day.date))}</dt>
                <dd className={styles['said']}>{say(hoursOf(day))}</dd>
                {remarksOf(day) !== '' && (
                  <dd className={styles['remarks']}>{remarksOf(day)}</dd>
                )}
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}
