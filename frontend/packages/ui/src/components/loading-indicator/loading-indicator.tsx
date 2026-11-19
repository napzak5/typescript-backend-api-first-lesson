import styles from './loading-indicator.module.css'

export type LoadingIndicatorProps = {
  /** What is being waited for, when 「読み込み中」 is not enough */
  label?: string | undefined
}

/**
 * Says that content is on its way, to the eye and to assistive technology.
 * Render it in place of the content that is loading.
 */
export const LoadingIndicator = ({
  label = '読み込み中',
}: LoadingIndicatorProps) => (
  <p className={styles['loadingIndicator']} role='status'>
    <span className={styles['spinner']} aria-hidden='true' />
    {label}
  </p>
)
