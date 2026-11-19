import { ButtonLink } from '@beauty-salon-frontend/ui'
import styles from './day-switch.module.css'

export type DaySwitchProps = {
  /** The addresses of the list of the day before, of today and of the day after */
  dayBeforeHref: string
  todayHref: string
  dayAfterHref: string
}

/** The links to the bookings of the days next to the one shown, and of today. */
export const DaySwitch = ({
  dayBeforeHref,
  todayHref,
  dayAfterHref,
}: DaySwitchProps) => (
  <nav className={styles['daySwitch']} aria-label='予約の日'>
    <ButtonLink href={dayBeforeHref} variant='secondary' size='small'>
      前の日
    </ButtonLink>
    <ButtonLink href={todayHref} variant='secondary' size='small'>
      今日
    </ButtonLink>
    <ButtonLink href={dayAfterHref} variant='secondary' size='small'>
      次の日
    </ButtonLink>
  </nav>
)
