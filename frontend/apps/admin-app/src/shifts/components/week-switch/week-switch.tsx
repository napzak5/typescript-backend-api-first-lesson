import { ButtonLink } from '@beauty-salon-frontend/ui'
import styles from './week-switch.module.css'

export type WeekSwitchProps = {
  /** The addresses of the shifts of the week before, of this week and of the week after */
  weekBeforeHref: string
  thisWeekHref: string
  weekAfterHref: string
}

/** The links to the shifts of the weeks next to the one shown, and of this week. */
export const WeekSwitch = ({
  weekBeforeHref,
  thisWeekHref,
  weekAfterHref,
}: WeekSwitchProps) => (
  <nav className={styles['weekSwitch']} aria-label='シフトの週'>
    <ButtonLink href={weekBeforeHref} size='small'>
      前の週
    </ButtonLink>
    <ButtonLink href={thisWeekHref} size='small'>
      今週
    </ButtonLink>
    <ButtonLink href={weekAfterHref} size='small'>
      次の週
    </ButtonLink>
  </nav>
)
