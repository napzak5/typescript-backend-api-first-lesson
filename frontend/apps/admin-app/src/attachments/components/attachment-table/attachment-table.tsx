import { momentNameAt, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminAttachmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { UploadedAttachment } from '../../api/attachments-api'
import { contentTypeNameOf, sizeNameOf } from '../../utils/attachment-file'

const { table: TABLE } = adminAttachmentMessages

export type AttachmentTableProps = {
  /** The files that were read so far, the latest uploaded first; at least one */
  attachments: readonly UploadedAttachment[]
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  /** Who uploaded a file, by the ID of the account */
  uploaderName: (uploadedBy: string) => LocalizedText
  /** The screen of a file */
  attachmentHref: (attachmentId: string) => string
  /** How many files there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the files that come next */
  onMore: () => void
}

/**
 * The files of a salon: the name each was uploaded under, which leads to
 * it, its kind, its size, who uploaded it, and when.
 */
export const AttachmentTable = ({
  attachments,
  timezone,
  uploaderName,
  attachmentHref,
  total,
  more,
  onMore,
}: AttachmentTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(TABLE.caption)}
      columns={[
        {
          key: 'filename',
          header: say(TABLE.filename),
          cell: ({ id, filename }) => (
            <Link href={attachmentHref(id)}>{filename}</Link>
          ),
        },
        {
          key: 'contentType',
          header: say(TABLE.type),
          cell: ({ contentType }) => say(contentTypeNameOf(contentType)),
        },
        {
          key: 'size',
          header: say(TABLE.size),
          cell: ({ size }) => say(sizeNameOf(size)),
        },
        {
          key: 'uploadedBy',
          header: say(TABLE.uploader),
          cell: ({ uploadedBy }) => say(uploaderName(uploadedBy)),
        },
        {
          key: 'uploadedAt',
          header: say(TABLE.uploadedAt),
          cell: ({ uploadedAt }) => say(momentNameAt(uploadedAt, timezone)),
        },
      ]}
      rows={attachments}
      rowKey={({ id }) => id}
      emptyMessage={say(adminAttachmentMessages.none)}
      count={say(countOf(total, attachments.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
