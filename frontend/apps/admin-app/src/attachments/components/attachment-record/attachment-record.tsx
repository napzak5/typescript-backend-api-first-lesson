import type { ModelsAttachmentResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Button,
  Card,
  DescriptionList,
  Dialog,
  inJapanese,
  LoadingIndicator,
  Note,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { match } from 'ts-pattern'
import {
  contentTypeNameOf,
  isImage,
  REMOVAL_NOTE,
  sizeNameOf,
} from '../../utils/attachment-file'
import styles from './attachment-record.module.css'

/** The URLs of the storage that open a file and save it, which last five minutes */
export type FileLinks =
  | { type: 'reading' }
  | { type: 'issued'; open: string; save: string }
  /** They could not be read: the message says why */
  | { type: 'unread'; message: string }

export type AttachmentRecordProps = {
  attachment: ModelsAttachmentResponse
  /** The time zone of the salon, which the moment of the upload is said in */
  timezone: string
  /** Who uploaded the file */
  uploaderName: string
  links: FileLinks
  /** Reads the URLs again */
  onRetryLinks: () => void
  /** The URLs are read again */
  retryingLinks?: boolean | undefined
  /** Whether the account removes the file */
  removes: boolean
  /** The removal is on its way */
  pending?: boolean | undefined
  /** Whether the dialog of the removal is open */
  asking?: boolean | undefined
  /** What went wrong with the removal, in the dialog */
  message?: string | undefined
  /** The button of the removal was pressed: the dialog opens */
  onAsk: () => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  onRemove: () => void
}

/**
 * A file of the salon: an image is shown, and every file is opened in a
 * tab of its own or saved under its name, at URLs of the storage. What is
 * known of it follows. A removal cannot be taken back, so a dialog asks
 * first; an account that may not remove the file is told who may.
 */
export const AttachmentRecord = ({
  attachment,
  timezone,
  uploaderName,
  links,
  onRetryLinks,
  retryingLinks = false,
  removes,
  pending = false,
  asking = false,
  message,
  onAsk,
  onClose,
  onRemove,
}: AttachmentRecordProps) => (
  <Card title='ファイル'>
    <div className={styles['record']}>
      {match(links)
        .with({ type: 'reading' }, () => (
          <LoadingIndicator label='ファイルを開く準備をしています' />
        ))
        .with({ type: 'unread' }, ({ message: why }) => (
          <UnreadNotice
            message={why}
            onRetry={onRetryLinks}
            pending={retryingLinks}
          />
        ))
        .with({ type: 'issued' }, ({ open, save }) => (
          <>
            {isImage(attachment.contentType) && (
              <img
                className={styles['preview']}
                src={open}
                alt={attachment.filename}
              />
            )}
            <ul className={styles['links']} aria-label='ファイルを開く'>
              <li>
                <a href={open} target='_blank' rel='noopener noreferrer'>
                  新しいタブで開く
                </a>
              </li>
              <li>
                <a href={save} rel='noreferrer'>
                  保存する
                </a>
              </li>
            </ul>
          </>
        ))
        .exhaustive()}
      <DescriptionList
        items={[
          { term: 'ファイル名', description: attachment.filename },
          {
            term: '種類',
            description: contentTypeNameOf(attachment.contentType),
          },
          {
            term: 'サイズ',
            description: `${sizeNameOf(attachment.size)}（${inJapanese(formats.bytesOf(attachment.size))}）`,
          },
          { term: 'アップロードした人', description: uploaderName },
          {
            term: 'アップロード日時',
            description: momentNameAt(
              attachment.uploadedAt ?? attachment.createdAt,
              timezone,
            ),
          },
        ]}
      />
      {removes ? (
        <Button variant='danger' onClick={onAsk}>
          ファイルを削除する
        </Button>
      ) : (
        <Note>{REMOVAL_NOTE}</Note>
      )}
    </div>
    <Dialog
      open={asking}
      onClose={onClose}
      title='ファイルを削除しますか？'
      description={`「${attachment.filename}」を、サロンのファイルから削除します。削除したファイルは元に戻せません。このファイルの共有リンクも、使えなくなります。`}
      actions={
        <>
          <Button onClick={onClose}>戻る</Button>
          <Button variant='danger' pending={pending} onClick={onRemove}>
            削除する
          </Button>
        </>
      }
    >
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
    </Dialog>
  </Card>
)
