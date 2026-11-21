import type { ModelsAttachmentResponse } from '@beauty-salon-frontend/api-client'
import {
  countOf,
  momentNameAt,
  PagedTable,
} from '@beauty-salon-frontend/salon-screens'
import { Link, type More } from '@beauty-salon-frontend/ui'
import { contentTypeNameOf, sizeNameOf } from '../../attachment-file'

export type AttachmentTableProps = {
  /** The files that were read so far, the latest uploaded first; at least one */
  attachments: readonly ModelsAttachmentResponse[]
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  /** Who uploaded a file, by the ID of the account */
  uploaderName: (uploadedBy: string) => string
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
}: AttachmentTableProps) => (
  <PagedTable
    caption='ファイル'
    columns={[
      {
        key: 'filename',
        header: 'ファイル名',
        cell: ({ id, filename }) => (
          <Link href={attachmentHref(id)}>{filename}</Link>
        ),
      },
      {
        key: 'contentType',
        header: '種類',
        cell: ({ contentType }) => contentTypeNameOf(contentType),
      },
      {
        key: 'size',
        header: 'サイズ',
        cell: ({ size }) => sizeNameOf(size),
      },
      {
        key: 'uploadedBy',
        header: 'アップロードした人',
        cell: ({ uploadedBy }) => uploaderName(uploadedBy),
      },
      {
        key: 'uploadedAt',
        header: 'アップロード日時',
        cell: ({ uploadedAt, createdAt }) =>
          momentNameAt(uploadedAt ?? createdAt, timezone),
      },
    ]}
    rows={attachments}
    rowKey={({ id }) => id}
    emptyMessage='ファイルはありません'
    count={countOf(total, attachments.length, '件')}
    more={more}
    onMore={onMore}
  />
)
