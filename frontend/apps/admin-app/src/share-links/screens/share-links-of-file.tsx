import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSignedInUser } from '@beauty-salon-frontend/session'
import { moreOf } from '@beauty-salon-frontend/ui'
import { adminShareLinkMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery } from '@tanstack/react-query'
import { match } from 'ts-pattern'
import type { UploadedAttachment } from '../../attachments/api/attachments-api'
import { shareLinkEntryHrefOf, shareLinkHrefOf } from '../../navigation'
import { readShareLinkPage, shareLinksKeyOf } from '../api/share-links-api'
import { NotTheirsToShare } from '../components/not-theirs-to-share/not-theirs-to-share'
import {
  ShareLinkList,
  type ShareLinkListing,
} from '../components/share-link-list/share-link-list'
import { sharesFiles } from '../utils/share-link'

type ShareLinksOfFileProps = {
  salon: ModelsSalonResponse
  attachment: UploadedAttachment
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
    getNextPageParam: cursorAfter,
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
      message: unreadMessageOf(adminShareLinkMessages.names.shareLinks, reason),
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
 * manager and an administrator. Everybody else is told who shares a file.
 * The file is one whose upload was finished: the screen of a file whose
 * upload is awaited says that it is not found.
 */
export const ShareLinksOfFile = ({
  salon,
  attachment,
}: ShareLinksOfFileProps) => {
  const user = useSignedInUser()

  return user !== undefined && sharesFiles(user.role) ? (
    <ListedShareLinks salon={salon} attachment={attachment} />
  ) : (
    <NotTheirsToShare />
  )
}
