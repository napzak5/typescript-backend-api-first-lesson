import { useSay } from '@beauty-salon-frontend/ui'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import styles from './backup-code-list.module.css'

export type BackupCodeListProps = {
  /** The codes, as the API issued them */
  codes: readonly string[]
}

/**
 * The backup codes, each of which takes the place of a code of the
 * authenticator app once. They are shown when they are issued, and never
 * again.
 */
export const BackupCodeList = ({ codes }: BackupCodeListProps) => {
  const say = useSay()

  return (
    <ol
      className={styles['codes']}
      aria-label={say(securityMessages.twoFactor.backupCodes)}
    >
      {codes.map((code) => (
        <li key={code} className={styles['code']}>
          <code>{code}</code>
        </li>
      ))}
    </ol>
  )
}
