import type {
  ModelsAttachmentResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { useInfiniteQuery } from '@tanstack/react-query'
import { match } from 'ts-pattern'
import { shareLinkEntryHrefOf, shareLinkHrefOf } from '../navigation'
import { cursorAfter, firstCursor, listingOf, moreOf } from '../pages'
import { FAILED, unreadMessageOf } from '../reading'
import {
  ShareLinkList,
  type ShareLinkListing,
} from './components/share-link-list/share-link-list'
import { NOT_UPLOADED_NOTE, SHARING_NOTE, sharesFiles } from './share-link'
import { readShareLinkPage, shareLinksKeyOf } from './share-links-api'

type ShareLinksOfFileProps = {
  salon: ModelsSalonResponse
  attachment: ModelsAttachmentResponse
}

/**
 * The links of a file, read whenever the screen of the file opens: others
 * issue and revoke them, and the downloads they give go on.
 */
const ListedShareLinks = ({ salon, attachment }: ShareLinksOfFileProps) => {
  const read = useInfiniteQuery({
    queryKey: [...shareLinksKeyOf(attachment.id), 'list'],
    queryFn: ({ pageParam }) => readShareLinkPage(attachment.id, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: (page) =>
      page.type === 'found' ? cursorAfter(page) : undefined,
    staleTime: 0,
  })
  const listed =
    read.data === undefined
      ? undefined
      : listingOf(
          // The account was allowed the first page: a refusal after it is
          // a role or a file that changed meanwhile, and ends the list
          read.data.pages.map((page) =>
            page.type === 'forbidden' || page.type === 'notFound'
              ? FAILED
              : page,
          ),
        )
  const listing = match(listed)
    .returnType<ShareLinkListing>()
    .with(undefined, () => ({ type: 'reading' }))
    .with({ type: 'unread' }, ({ reason }) => ({
      type: 'unread',
      message: unreadMessageOf('共有リンク', reason),
    }))
    .with({ type: 'listed' }, ({ items, total, rest }) => ({
      type: 'listed',
      shareLinks: items,
      total,
      more: moreOf(rest, {
        nextPage: read.isFetchingNextPage,
        again: read.isRefetching,
      }),
    }))
    .exhaustive()

  return (
    <ShareLinkList
      listing={listing}
      timezone={salon.timezone}
      now={new Date()}
      entryHref={shareLinkEntryHrefOf(salon.id, attachment.id)}
      shareLinkHref={(id) => shareLinkHrefOf(salon.id, attachment.id, id)}
      onRetry={() => void read.refetch()}
      retrying={read.isFetching}
      onMore={() =>
        void (listed?.type === 'listed' && listed.rest === 'unread'
          ? read.refetch()
          : read.fetchNextPage())
      }
    />
  )
}

/**
 * The share links of a file, below it on its screen, for the owner, a
 * manager and an administrator. Everybody else is told who shares a file;
 * a file whose upload was not finished is shared by nobody.
 */
export const ShareLinksOfFile = ({
  salon,
  attachment,
}: ShareLinksOfFileProps) => {
  const session = useSession()
  const role = session.type === 'signedIn' ? session.user.role : ''
  const note = match({ status: attachment.status, shares: sharesFiles(role) })
    .returnType<string | undefined>()
    .with({ status: 'pending' }, () => NOT_UPLOADED_NOTE)
    .with({ shares: false }, () => SHARING_NOTE)
    .otherwise(() => undefined)

  return note === undefined ? (
    <ListedShareLinks salon={salon} attachment={attachment} />
  ) : (
    <ShareLinkList
      listing={{ type: 'notShared', note }}
      timezone={salon.timezone}
      now={new Date()}
      entryHref={shareLinkEntryHrefOf(salon.id, attachment.id)}
      shareLinkHref={(id) => shareLinkHrefOf(salon.id, attachment.id, id)}
      onRetry={() => undefined}
      onMore={() => undefined}
    />
  )
}
