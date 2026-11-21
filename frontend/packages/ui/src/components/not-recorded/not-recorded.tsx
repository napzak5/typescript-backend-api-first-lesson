import styles from './not-recorded.module.css'

/**
 * What a value that was not recorded (a column that holds `null`) is said
 * as. A sentence that needs the word reads it from here. An empty list, a
 * zero and the no of a yes or no are 「なし」, which says something else.
 */
export const NOT_RECORDED = '記録なし'

/**
 * A value that was not recorded, said in words and more quietly than the
 * values around it, so that the recorded ones stand out. `DescriptionList`
 * and `Table` show it for a value of `null`.
 */
export const NotRecorded = () => (
  <span className={styles['notRecorded']}>{NOT_RECORDED}</span>
)
