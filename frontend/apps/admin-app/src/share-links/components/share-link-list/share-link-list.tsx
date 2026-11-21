import type { ModelsShareLinkResponse } from '@beauty-salon-frontend/api-client'
import {
  countOf,
  type More,
  momentNameAt,
  PagedTable,
} from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Link,
  LoadingIndicator,
  Note,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import {
  downloadsNameOf,
  passwordNameOf,
  SHARE_LINKS_NOTE,
  stateNameOf,
  stateOf,
} from '../../share-link'
import styles from './share-link-list.module.css'

/** What the part shows of the links of a file */
export type ShareLinkListing =
  /** The file is not shared by the account, or not one to share: the note says why */
  | { type: 'notShared'; note: string }
  | { type: 'reading' }
  /** They could not be read: the message says why */
  | { type: 'unread'; message: string }
  | {
      type: 'listed'
      /** The links that were read so far, the latest issued first */
      shareLinks: readonly ModelsShareLinkResponse[]
      /** How many links the file has; `null` when the API did not count them */
      total: number | null
      more: More
    }

export type ShareLinkListProps = {
  listing: ShareLinkListing
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  /** The moment the states of the links are those of */
  now: Date
  /** The form that issues a link */
  entryHref: string
  /** The screen of a link */
  shareLinkHref: (shareLinkId: string) => string
  /** Reads the links again */
  onRetry: () => void
  /** The links are read again */
  retrying?: boolean | undefined
  /** Asks for the links that come next */
  onMore: () => void
}

/**
 * The share links of a file, below the file: what a link is, the button
 * that issues one, and the links issued, the latest first, each with when
 * it ends, how often it gave the file, whether it has a password and
 * whether it still opens the file. A link leads to its screen, which
 * revokes it.
 */
export const ShareLinkList = ({
  listing,
  timezone,
  now,
  entryHref,
  shareLinkHref,
  onRetry,
  retrying = false,
  onMore,
}: ShareLinkListProps) => (
  <Card
    title='共有リンク'
    actions={
      listing.type === 'notShared' ? undefined : (
        <ButtonLink href={entryHref}>共有リンクを発行する</ButtonLink>
      )
    }
  >
    <div className={styles['list']}>
      <Note>
        {listing.type === 'notShared' ? listing.note : SHARE_LINKS_NOTE}
      </Note>
      {match(listing)
        .with({ type: 'notShared' }, () => null)
        .with({ type: 'reading' }, () => (
          <LoadingIndicator label='共有リンクを読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ message }) => (
          <UnreadNotice
            message={message}
            onRetry={onRetry}
            pending={retrying}
          />
        ))
        .with({ type: 'listed', shareLinks: [] }, () => (
          <EmptyState
            title='共有リンクはありません'
            description='「共有リンクを発行する」から、有効期間、ダウンロードの回数の上限、パスワードを決めて発行できます。'
          />
        ))
        .with({ type: 'listed' }, ({ shareLinks, total, more }) => (
          <PagedTable
            caption='発行した共有リンク'
            columns={[
              {
                key: 'createdAt',
                header: '発行日時',
                cell: ({ id, createdAt }) => (
                  <Link href={shareLinkHref(id)}>
                    {momentNameAt(createdAt, timezone)}
                  </Link>
                ),
              },
              {
                key: 'expiresAt',
                header: '有効期限',
                cell: ({ expiresAt }) => momentNameAt(expiresAt, timezone),
              },
              {
                key: 'downloadCount',
                header: 'ダウンロード',
                cell: downloadsNameOf,
              },
              {
                key: 'hasPassword',
                header: 'パスワード',
                cell: ({ hasPassword }) => passwordNameOf(hasPassword),
              },
              {
                key: 'state',
                header: '状態',
                cell: (shareLink) => {
                  const state = stateOf(shareLink, now)

                  return (
                    <Badge tone={state === 'usable' ? 'success' : 'neutral'}>
                      {stateNameOf(state)}
                    </Badge>
                  )
                },
              },
            ]}
            rows={shareLinks}
            rowKey={({ id }) => id}
            emptyMessage='共有リンクはありません'
            count={countOf(total, shareLinks.length, '件')}
            more={more}
            onMore={onMore}
          />
        ))
        .exhaustive()}
    </div>
  </Card>
)
