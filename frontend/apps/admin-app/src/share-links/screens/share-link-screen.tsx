import {
  UNREAD_TYPES,
  unreadMessageOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsAttachmentResponse,
  ModelsSalonResponse,
  ModelsShareLinkResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  attachmentKeyOf,
  readAttachment,
} from '../../attachments/api/attachments-api'
import { useUploaderName } from '../../attachments/hooks/use-uploader-name'
import { AttachmentNotFound } from '../../attachments/screens/attachment-not-found'
import { attachmentHrefOf } from '../../navigation'
import {
  readShareLink,
  revokeShareLink,
  shareLinkKeyOf,
  shareLinksKeyOf,
} from '../api/share-links-api'
import { ShareLinkRecord } from '../components/share-link-record/share-link-record'
import { afterRevoking, sharesFiles } from '../utils/share-link'
import {
  ShareLinkNotFound,
  SharingForbidden,
  ToTheFile,
} from './share-link-notices'

const TITLE = '共有リンク'

type ShareLinkDetailsProps = {
  salon: ModelsSalonResponse
  attachment: ModelsAttachmentResponse
  shareLink: ModelsShareLinkResponse
}

/**
 * A link of a file and its revocation. After the revocation the screen
 * goes back to the file, whose links are read anew.
 */
const ShareLinkDetails = ({
  salon,
  attachment,
  shareLink,
}: ShareLinkDetailsProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const issuerName = useUploaderName(salon.id)
  const [asking, setAsking] = useState(false)
  const [message, setMessage] = useState<string>()

  const revocation = useMutation({
    mutationFn: () => revokeShareLink(shareLink.id),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'revoked' }, () => {
          queryClient.removeQueries({
            queryKey: shareLinksKeyOf(attachment.id),
          })
          notify({ tone: 'success', message: '共有リンクを取り消しました。' })
          void navigate(attachmentHrefOf(salon.id, attachment.id))
        })
        // Revoked meanwhile, or its file removed: it is read anew, and the
        // screen says it is gone
        .with({ type: 'notFound' }, () => {
          setAsking(false)
          queryClient.removeQueries({
            queryKey: shareLinksKeyOf(attachment.id),
          })
          void queryClient.invalidateQueries({
            queryKey: shareLinkKeyOf(shareLink.id),
            exact: true,
          })
        })
        .with(
          { type: P.union('forbidden', 'tooManyRequests', 'failed') },
          (refused) => setMessage(afterRevoking(refused)),
        )
        .exhaustive(),
  })

  return (
    <ShareLinkRecord
      shareLink={shareLink}
      timezone={salon.timezone}
      now={new Date()}
      issuerName={issuerName(shareLink.createdBy)}
      pending={revocation.isPending}
      asking={asking}
      message={message}
      onAsk={() => {
        setMessage(undefined)
        setAsking(true)
      }}
      onClose={() => setAsking(false)}
      onRevoke={() => {
        setMessage(undefined)
        revocation.mutate()
      }}
    />
  )
}

type ShareLinkPartProps = {
  salon: ModelsSalonResponse
  attachmentId: string
  shareLinkId: string
}

/**
 * The file of the address and its link, read whenever the screen opens.
 * The link is never shown as an earlier screen read it: it may have been
 * revoked since. A link of another file is not found at the address of
 * this one, nor is a file of another salon.
 */
const ShareLinkPart = ({
  salon,
  attachmentId,
  shareLinkId,
}: ShareLinkPartProps) => {
  const file = useQuery({
    queryKey: attachmentKeyOf(attachmentId),
    queryFn: () => readAttachment(attachmentId),
    staleTime: 0,
  })
  const link = useQuery({
    queryKey: shareLinkKeyOf(shareLinkId),
    queryFn: () => readShareLink(shareLinkId),
    staleTime: 0,
  })
  const header = <PageHeader title={TITLE} description={salon.name} />
  const linkRead = link.isFetchedAfterMount ? link.data : undefined
  return (
    match([file.data, linkRead])
      .returnType<ReactNode>()
      .with([{ type: 'notFound' }, P._], () => (
        <AttachmentNotFound salonId={salon.id} />
      ))
      // The salon is compared by a predicate: as a pattern, a string that is
      // no literal would rule out every file
      .with(
        [
          {
            type: 'found',
            attachment: P.when(({ salonId }) => salonId !== salon.id),
          },
          P._,
        ],
        () => <AttachmentNotFound salonId={salon.id} />,
      )
      // A role that shares no file is not shown this screen: a refusal is a
      // link of a file of another salon
      .with([P._, { type: P.union('notFound', 'forbidden') }], () => (
        <ShareLinkNotFound salonId={salon.id} attachmentId={attachmentId} />
      ))
      .with(
        [{ type: 'found' }, { type: 'found' }],
        ([{ attachment }, { shareLink }]) =>
          shareLink.attachmentId === attachment.id ? (
            <>
              <PageHeader
                title={TITLE}
                description={`${attachment.filename}（${salon.name}）`}
              />
              <ShareLinkDetails
                salon={salon}
                attachment={attachment}
                shareLink={shareLink}
              />
              <ToTheFile salonId={salon.id} attachmentId={attachment.id} />
            </>
          ) : (
            <ShareLinkNotFound salonId={salon.id} attachmentId={attachmentId} />
          ),
      )
      .with(
        P.union(
          [{ type: P.union(...UNREAD_TYPES) }, P._],
          [P._, { type: P.union(...UNREAD_TYPES) }],
        ),
        () => (
          <>
            {header}
            <UnreadNotice
              message={unreadMessageOf(
                '共有リンク',
                whyUnread([file.data, linkRead]),
              )}
              onRetry={() => {
                void file.refetch()
                void link.refetch()
              }}
              pending={file.isFetching || link.isFetching}
            />
          </>
        ),
      )
      .with(P.union([undefined, P._], [P._, undefined]), () => (
        <>
          {header}
          <LoadingIndicator label='共有リンクを読み込んでいます' />
        </>
      ))
      .exhaustive()
  )
}

/** A share link of a file of the salon of the address, for its owner, its managers and an administrator. */
export const ShareLinkScreen = () => {
  const { salonId = '', attachmentId = '', shareLinkId = '' } = useParams()
  const session = useSession()
  const shares = session.type === 'signedIn' && sharesFiles(session.user.role)

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        shares ? (
          <ShareLinkPart
            key={`${attachmentId}/${shareLinkId}`}
            salon={salon}
            attachmentId={attachmentId}
            shareLinkId={shareLinkId}
          />
        ) : (
          <SharingForbidden
            title={TITLE}
            salon={salon}
            attachmentId={attachmentId}
          />
        )
      }
    </WithSalon>
  )
}
