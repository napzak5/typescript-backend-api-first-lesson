import type { ModelsShareLinkResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Badge,
  Button,
  Card,
  DescriptionList,
  Dialog,
  Note,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminShareLinkMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  downloadsNameOf,
  passwordNameOf,
  stateNameOf,
  stateOf,
} from '../../utils/share-link'
import styles from './share-link-record.module.css'

const { record: RECORD, revocation: REVOCATION } = adminShareLinkMessages

export type ShareLinkRecordProps = {
  shareLink: ModelsShareLinkResponse
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  /** The moment the state of the link is that of */
  now: Date
  /** Who issued the link */
  issuerName: LocalizedText
  /** The revocation is on its way */
  pending?: boolean | undefined
  /** Whether the dialog of the revocation is open */
  asking?: boolean | undefined
  /** What went wrong with the revocation, in the dialog */
  message?: LocalizedText | undefined
  /** The button of the revocation was pressed: the dialog opens */
  onAsk: () => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  onRevoke: () => void
}

/**
 * A share link of a file: whether it still opens the file, when it ends,
 * how often it gave the file, whether it has a password, and who issued
 * it when. Its token was shown once, when it was issued. A revocation
 * cannot be taken back, so a dialog asks first.
 */
export const ShareLinkRecord = ({
  shareLink,
  timezone,
  now,
  issuerName,
  pending = false,
  asking = false,
  message,
  onAsk,
  onClose,
  onRevoke,
}: ShareLinkRecordProps) => {
  const say = useSay()
  const state = stateOf(shareLink, now)

  return (
    <Card title={say(RECORD.title)}>
      <div className={styles['record']}>
        <DescriptionList
          items={[
            {
              term: say(RECORD.state),
              description: (
                <Badge tone={state === 'usable' ? 'success' : 'neutral'}>
                  {say(stateNameOf(state))}
                </Badge>
              ),
            },
            {
              term: say(RECORD.expiresAt),
              description: say(momentNameAt(shareLink.expiresAt, timezone)),
            },
            {
              term: say(RECORD.downloads),
              description: say(downloadsNameOf(shareLink)),
            },
            {
              term: say(RECORD.password),
              description: say(passwordNameOf(shareLink.hasPassword)),
            },
            { term: say(RECORD.issuer), description: say(issuerName) },
            {
              term: say(RECORD.createdAt),
              description: say(momentNameAt(shareLink.createdAt, timezone)),
            },
          ]}
        />
        <Note>{say(RECORD.addressShownOnce)}</Note>
        <Button variant='danger' onClick={onAsk}>
          {say(REVOCATION.button)}
        </Button>
      </div>
      <Dialog
        open={asking}
        onClose={onClose}
        title={say(REVOCATION.title)}
        description={say(REVOCATION.description)}
        actions={
          <>
            <Button onClick={onClose}>{say(REVOCATION.back)}</Button>
            <Button variant='danger' pending={pending} onClick={onRevoke}>
              {say(REVOCATION.confirm)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </Card>
  )
}
