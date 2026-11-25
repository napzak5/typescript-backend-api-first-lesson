import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Button,
  Card,
  DescriptionList,
  Dialog,
  LoadingIndicator,
  Note,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminAttachmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { UploadedAttachment } from '../../api/attachments-api'
import {
  contentTypeNameOf,
  isImage,
  sizeNameOf,
} from '../../utils/attachment-file'
import styles from './attachment-record.module.css'

const { record: RECORD, removal: REMOVAL } = adminAttachmentMessages

/** The URLs of the storage that open a file and save it, which last five minutes */
export type FileLinks =
  | { type: 'reading' }
  | { type: 'issued'; open: string; save: string }
  /** They could not be read: the message says why */
  | { type: 'unread'; message: LocalizedText }

export type AttachmentRecordProps = {
  attachment: UploadedAttachment
  /** The time zone of the salon, which the moment of the upload is said in */
  timezone: string
  /** Who uploaded the file */
  uploaderName: LocalizedText
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
  message?: LocalizedText | undefined
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
}: AttachmentRecordProps) => {
  const say = useSay()

  return (
    <Card title={say(RECORD.title)}>
      <div className={styles['record']}>
        {match(links)
          .with({ type: 'reading' }, () => (
            <LoadingIndicator
              label={say(adminAttachmentMessages.loading.opening)}
            />
          ))
          .with({ type: 'unread' }, ({ message: why }) => (
            <UnreadNotice
              message={say(why)}
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
              <ul className={styles['links']} aria-label={say(RECORD.open)}>
                <li>
                  <a href={open} target='_blank' rel='noopener noreferrer'>
                    {say(RECORD.newTab)}
                  </a>
                </li>
                <li>
                  <a href={save} rel='noreferrer'>
                    {say(RECORD.save)}
                  </a>
                </li>
              </ul>
            </>
          ))
          .exhaustive()}
        <DescriptionList
          items={[
            { term: say(RECORD.filename), description: attachment.filename },
            {
              term: say(RECORD.type),
              description: say(contentTypeNameOf(attachment.contentType)),
            },
            {
              term: say(RECORD.size),
              description: say(
                RECORD.sizeOf(
                  sizeNameOf(attachment.size),
                  formats.bytesOf(attachment.size),
                ),
              ),
            },
            { term: say(RECORD.uploader), description: say(uploaderName) },
            {
              term: say(RECORD.uploadedAt),
              description: say(momentNameAt(attachment.uploadedAt, timezone)),
            },
          ]}
        />
        {removes ? (
          <Button variant='danger' onClick={onAsk}>
            {say(REMOVAL.button)}
          </Button>
        ) : (
          <Note>{say(REMOVAL.forbidden)}</Note>
        )}
      </div>
      <Dialog
        open={asking}
        onClose={onClose}
        title={say(REMOVAL.title)}
        description={say(REMOVAL.description(attachment.filename))}
        actions={
          <>
            <Button onClick={onClose}>{say(REMOVAL.back)}</Button>
            <Button variant='danger' pending={pending} onClick={onRemove}>
              {say(REMOVAL.confirm)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </Card>
  )
}
