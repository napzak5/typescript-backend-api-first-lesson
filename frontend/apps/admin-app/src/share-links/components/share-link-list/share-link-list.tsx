import type { ModelsShareLinkResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  ButtonLink,
  Card,
  COUNTED,
  countOf,
  EmptyState,
  Link,
  LoadingIndicator,
  type More,
  Note,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminShareLinkMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import {
  downloadsNameOf,
  passwordNameOf,
  stateNameOf,
  stateOf,
} from '../../utils/share-link'
import styles from './share-link-list.module.css'

const { list: LIST, loading: LOADING } = adminShareLinkMessages

/** What the part shows of the links of a file */
export type ShareLinkListing =
  | { type: 'reading' }
  /** They could not be read: the message says why */
  | { type: 'unread'; message: LocalizedText }
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
}: ShareLinkListProps) => {
  const say = useSay()

  return (
    <Card
      title={say(LIST.title)}
      actions={<ButtonLink href={entryHref}>{say(LIST.issue)}</ButtonLink>}
    >
      <div className={styles['list']}>
        <Note>{say(adminShareLinkMessages.about)}</Note>
        {match(listing)
          .with({ type: 'reading' }, () => (
            <LoadingIndicator label={say(LOADING.shareLinks)} />
          ))
          .with({ type: 'unread' }, ({ message }) => (
            <UnreadNotice
              message={say(message)}
              onRetry={onRetry}
              pending={retrying}
            />
          ))
          .with({ type: 'listed', shareLinks: [] }, () => (
            <EmptyState
              title={say(LIST.none)}
              description={say(LIST.noneDescription)}
            />
          ))
          .with({ type: 'listed' }, ({ shareLinks, total, more }) => (
            <PagedTable
              caption={say(LIST.caption)}
              columns={[
                {
                  key: 'createdAt',
                  header: say(LIST.createdAt),
                  cell: ({ id, createdAt }) => (
                    <Link href={shareLinkHref(id)}>
                      {say(momentNameAt(createdAt, timezone))}
                    </Link>
                  ),
                },
                {
                  key: 'expiresAt',
                  header: say(LIST.expiresAt),
                  cell: ({ expiresAt }) =>
                    say(momentNameAt(expiresAt, timezone)),
                },
                {
                  key: 'downloadCount',
                  header: say(LIST.downloads),
                  cell: (shareLink) => say(downloadsNameOf(shareLink)),
                },
                {
                  key: 'hasPassword',
                  header: say(LIST.password),
                  cell: ({ hasPassword }) => say(passwordNameOf(hasPassword)),
                },
                {
                  key: 'state',
                  header: say(LIST.state),
                  cell: (shareLink) => {
                    const state = stateOf(shareLink, now)

                    return (
                      <Badge tone={state === 'usable' ? 'success' : 'neutral'}>
                        {say(stateNameOf(state))}
                      </Badge>
                    )
                  },
                },
              ]}
              rows={shareLinks}
              rowKey={({ id }) => id}
              emptyMessage={say(LIST.none)}
              count={say(countOf(total, shareLinks.length, COUNTED.items))}
              more={more}
              onMore={onMore}
            />
          ))
          .exhaustive()}
      </div>
    </Card>
  )
}
