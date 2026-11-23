import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { useSay } from '../../hooks/language'
import styles from './not-recorded.module.css'

/**
 * What a value that was not recorded (a column that holds `null`) is said
 * as. A sentence that needs the word reads it from here. An empty list, a
 * zero and the no of a yes or no are 「なし」 (`NONE`), which says something
 * else.
 */
export const NOT_RECORDED: LocalizedText = uiMessages.notRecorded

/**
 * What an empty list, a zero and the no of a yes or no are said as: there
 * is none, and that is what was recorded.
 */
export const NONE: LocalizedText = uiMessages.none

/**
 * A value that was not recorded, said in words and more quietly than the
 * values around it, so that the recorded ones stand out. `DescriptionList`
 * and `Table` show it for a value of `null`.
 */
export const NotRecorded = () => {
  const say = useSay()

  return <span className={styles['notRecorded']}>{say(NOT_RECORDED)}</span>
}
