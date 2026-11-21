import type {
  ModelsBusinessHours,
  ModelsOpeningHours,
} from '@beauty-salon-frontend/api-client'
import { EmptyState } from '@beauty-salon-frontend/ui'
import {
  calendarDateOf,
  comingDays,
  hoursOf,
  weeklyHoursOf,
} from '../../salon-format'
import styles from './salon-hours.module.css'

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
  const dates = comingDays(openingHours, today, MOST_DATES)

  return (
    <div className={styles['hours']}>
      <div className={styles['part']}>
        <h3 className={styles['title']}>曜日ごとの営業時間</h3>
        {businessHours === null ? (
          <EmptyState
            kind='part'
            title='曜日ごとの営業時間は、登録されていません。'
          />
        ) : (
          <dl className={styles['days']}>
            {weeklyHoursOf(businessHours, timezone).map((day) => (
              <div key={day.day} className={styles['day']}>
                <dt>{day.name}</dt>
                <dd className={styles['said']}>{day.hours}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className={styles['part']}>
        <h3 className={styles['title']}>日付ごとの営業時間</h3>
        <p className={styles['note']}>
          {dates.length === 0
            ? '日付ごとに決めた営業時間は、ありません。'
            : '下の日は、曜日ごとの営業時間ではなく、このとおりに営業します。'}
        </p>
        {dates.length > 0 && (
          <dl className={styles['days']}>
            {dates.map((day) => (
              <div key={day.date} className={styles['day']}>
                <dt>{calendarDateOf(day.date)}</dt>
                <dd className={styles['said']}>{hoursOf(day)}</dd>
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
