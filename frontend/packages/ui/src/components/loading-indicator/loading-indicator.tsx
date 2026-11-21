import styles from './loading-indicator.module.css'

export type LoadingIndicatorProps = {
  /** What is being waited for: 「予約を読み込み中」 */
  label: string
}

/**
 * Says that content is on its way, to the eye and to assistive technology.
 * Render it in place of the content that is loading.
 */
export const LoadingIndicator = ({ label }: LoadingIndicatorProps) => (
  <p className={styles['loadingIndicator']} role='status'>
    <span className={styles['spinner']} aria-hidden='true' />
    {label}
  </p>
)
