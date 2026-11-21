import type { ModelsShareLinkResponse } from '@beauty-salon-frontend/api-client'
import {
  Alert,
  Badge,
  Button,
  Card,
  DescriptionList,
  Dialog,
} from '@beauty-salon-frontend/ui'
import { momentNameAt } from '../../../salon-time'
import {
  downloadsNameOf,
  passwordNameOf,
  stateNameOf,
  stateOf,
} from '../../share-link'
import styles from './share-link-record.module.css'

export type ShareLinkRecordProps = {
  shareLink: ModelsShareLinkResponse
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  /** The moment the state of the link is that of */
  now: Date
  /** Who issued the link */
  issuerName: string
  /** The revocation is on its way */
  pending?: boolean | undefined
  /** Whether the dialog of the revocation is open */
  asking?: boolean | undefined
  /** What went wrong with the revocation, in the dialog */
  message?: string | undefined
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
  const state = stateOf(shareLink, now)

  return (
    <Card title='共有リンク'>
      <div className={styles['record']}>
        <DescriptionList
          items={[
            {
              term: '状態',
              description: (
                <Badge tone={state === 'usable' ? 'success' : 'neutral'}>
                  {stateNameOf(state)}
                </Badge>
              ),
            },
            {
              term: '有効期限',
              description: momentNameAt(shareLink.expiresAt, timezone),
            },
            { term: 'ダウンロード', description: downloadsNameOf(shareLink) },
            {
              term: 'パスワード',
              description: passwordNameOf(shareLink.hasPassword),
            },
            { term: '発行した人', description: issuerName },
            {
              term: '発行日時',
              description: momentNameAt(shareLink.createdAt, timezone),
            },
          ]}
        />
        <p className={styles['note']}>
          リンクのアドレスは、発行したときにだけ表示しました。なくしたときは、この共有リンクを取り消して、発行し直してください。
        </p>
        <div className={styles['buttons']}>
          <Button variant='danger' onClick={onAsk}>
            共有リンクを取り消す
          </Button>
        </div>
      </div>
      <Dialog
        open={asking}
        onClose={onClose}
        title='共有リンクを取り消しますか？'
        description='このリンクは、すぐに使えなくなります。取り消した共有リンクは、元に戻せません。'
        actions={
          <>
            <Button onClick={onClose}>戻る</Button>
            <Button variant='danger' pending={pending} onClick={onRevoke}>
              取り消す
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      </Dialog>
    </Card>
  )
}
