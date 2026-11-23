import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { useSay } from '../../hooks/language'
import { Actions } from '../actions/actions'
import { ButtonLink } from '../button-link/button-link'

/** What one step of the links goes: a day, or a week */
export type PeriodUnit = 'day' | 'week'

export type PeriodSwitchProps = {
  /** The name of the navigation: what is shown by the period, 「予約の日」 */
  label: string
  unit: PeriodUnit
  /** The address of the period before the one shown; without it there is none to go to */
  beforeHref?: string | undefined
  /** The address of the period that holds today */
  currentHref: string
  /** The address of the period after the one shown; without it there is none to go to */
  afterHref?: string | undefined
}

/**
 * The links from the period that is shown to the one before, to the one
 * that holds today and to the one after, in that order. A period that
 * cannot be shown (before the first day that is counted, after today) has
 * no link.
 */
export const PeriodSwitch = ({
  label,
  unit,
  beforeHref,
  currentHref,
  afterHref,
}: PeriodSwitchProps) => {
  const say = useSay()
  const words = uiMessages.periodSwitch[unit]

  return (
    <nav aria-label={label}>
      <Actions>
        {beforeHref !== undefined && (
          <ButtonLink href={beforeHref} size='small'>
            {say(words.before)}
          </ButtonLink>
        )}
        <ButtonLink href={currentHref} size='small'>
          {say(words.current)}
        </ButtonLink>
        {afterHref !== undefined && (
          <ButtonLink href={afterHref} size='small'>
            {say(words.after)}
          </ButtonLink>
        )}
      </Actions>
    </nav>
  )
}
