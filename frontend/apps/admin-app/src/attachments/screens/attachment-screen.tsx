import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsAttachmentResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminAttachmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { attachmentsHrefOf } from '../../navigation'
import { ShareLinksOfFile } from '../../share-links/screens/share-links-of-file'
import {
  attachmentKeyOf,
  attachmentsKeyOf,
  type DownloadRead,
  readAttachment,
  readDownloadUrl,
  removeAttachment,
} from '../api/attachments-api'
import {
  AttachmentRecord,
  type FileLinks,
} from '../components/attachment-record/attachment-record'
import { useUploaderName } from '../hooks/use-uploader-name'
import { afterRemoving, removesAttachment } from '../utils/attachment-file'
import { AttachmentNotFound, ToTheFiles } from './attachment-not-found'

const { titles, names, loading } = adminAttachmentMessages

/** The URLs last five minutes: they are read anew a minute before */
const LINKS_LAST = 4 * 60 * 1000

/**
 * The URLs that open a file and save it. They are read when the screen
 * opens, never taken from a screen before, and anew every four minutes,
 * whether the tab is shown or not, so that a link pressed is never one
 * that ran out. A file removed meanwhile is read anew: the screen then
 * says it is gone.
 */
const useLinks = (
  attachmentId: string,
): { links: FileLinks; retry: () => void; retrying: boolean } => {
  const queryClient = useQueryClient()
  const urlOf = (inline: boolean) => ({
    queryKey: [...attachmentKeyOf(attachmentId), inline ? 'open' : 'save'],
    queryFn: async (): Promise<DownloadRead> => {
      const read = await readDownloadUrl(attachmentId, inline)
      if (read.type === 'notFound') {
        void queryClient.invalidateQueries({
          queryKey: attachmentKeyOf(attachmentId),
          exact: true,
        })
      }
      return read
    },
    staleTime: LINKS_LAST,
    gcTime: 0,
    refetchInterval: LINKS_LAST,
    refetchIntervalInBackground: true,
  })
  const open = useQuery(urlOf(true))
  const save = useQuery(urlOf(false))

  const links = match(open.data)
    .returnType<FileLinks>()
    .with({ type: 'issued' }, ({ url: openUrl }) =>
      match(save.data)
        .returnType<FileLinks>()
        .with({ type: 'issued' }, ({ url: saveUrl }) => ({
          type: 'issued',
          open: openUrl,
          save: saveUrl,
        }))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => ({
          type: 'unread',
          message: unreadMessageOf(names.openingAddress, reason),
        }))
        .with(P.union(undefined, { type: 'notFound' }), () => ({
          type: 'reading',
        }))
        .exhaustive(),
    )
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => ({
      type: 'unread',
      message: unreadMessageOf(names.openingAddress, reason),
    }))
    .with(P.union(undefined, { type: 'notFound' }), () => ({ type: 'reading' }))
    .exhaustive()

  return {
    links,
    retry: () => {
      void open.refetch()
      void save.refetch()
    },
    retrying: open.isFetching || save.isFetching,
  }
}

type AttachmentDetailsProps = {
  salon: ModelsSalonResponse
  attachment: ModelsAttachmentResponse
}

/**
 * A file, the links that open and save it, and its removal, for the owner,
 * a manager, an administrator and whoever uploaded it. After the removal,
 * the screen goes back to the list, which is read anew.
 */
const AttachmentDetails = ({ salon, attachment }: AttachmentDetailsProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const session = useSession()
  const account =
    session.type === 'signedIn'
      ? { id: session.user.id, role: session.user.role }
      : { id: '', role: '' }
  const uploaderName = useUploaderName(salon.id)
  const { links, retry, retrying } = useLinks(attachment.id)
  const [asking, setAsking] = useState(false)
  const [message, setMessage] = useState<LocalizedText>()
  const key = attachmentKeyOf(attachment.id)

  const removal = useMutation({
    mutationFn: () => removeAttachment(attachment.id),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'removed' }, () => {
          queryClient.removeQueries({ queryKey: attachmentsKeyOf(salon.id) })
          notify({
            tone: 'success',
            message: adminAttachmentMessages.removal.done(attachment.filename),
          })
          void navigate(attachmentsHrefOf(salon.id))
        })
        // Removed meanwhile: it is read anew, and the screen says it is gone
        .with({ type: 'notFound' }, () => {
          setAsking(false)
          queryClient.removeQueries({ queryKey: attachmentsKeyOf(salon.id) })
          void queryClient.invalidateQueries({ queryKey: key, exact: true })
        })
        .with(
          { type: P.union('forbidden', 'tooManyRequests', 'failed') },
          (refused) => setMessage(afterRemoving(refused)),
        )
        .exhaustive(),
  })

  return (
    <AttachmentRecord
      attachment={attachment}
      timezone={salon.timezone}
      uploaderName={uploaderName(attachment.uploadedBy)}
      links={links}
      onRetryLinks={retry}
      retryingLinks={retrying}
      removes={removesAttachment(account, attachment)}
      pending={removal.isPending}
      asking={asking}
      message={message}
      onAsk={() => {
        setMessage(undefined)
        setAsking(true)
      }}
      onClose={() => setAsking(false)}
      onRemove={() => {
        setMessage(undefined)
        removal.mutate()
      }}
    />
  )
}

type AttachmentPartProps = {
  salon: ModelsSalonResponse
  attachmentId: string
}

/**
 * A file of the salon, read whenever the screen opens: others remove it at
 * any time. A file of another salon is not found at the address of this
 * one.
 *
 * The heading stays the one element while the screen reads what it shows
 * below it, so that the focus the heading took when the screen opened
 * stays on it.
 */
const AttachmentPart = ({ salon, attachmentId }: AttachmentPartProps) => {
  const read = useQuery({
    queryKey: attachmentKeyOf(attachmentId),
    queryFn: () => readAttachment(attachmentId),
    staleTime: 0,
  })
  const say = useSay()

  return (
    match(read.data)
      .with(undefined, () => (
        <>
          <PageHeader title={say(titles.file)} description={salon.name} />
          <LoadingIndicator label={say(loading.file)} />
        </>
      ))
      .with({ type: 'notFound' }, () => (
        <AttachmentNotFound salonId={salon.id} />
      ))
      // A file of another salon, or of none. The salon is compared by a
      // predicate: as a pattern, a string that is no literal would rule
      // out every file
      .with(
        {
          type: 'found',
          attachment: P.when(({ salonId }) => salonId !== salon.id),
        },
        () => <AttachmentNotFound salonId={salon.id} />,
      )
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <>
          <PageHeader title={say(titles.file)} description={salon.name} />
          <UnreadNotice
            message={say(unreadMessageOf(names.file, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .with({ type: 'found' }, ({ attachment }) => (
        <>
          <PageHeader title={attachment.filename} description={salon.name} />
          <AttachmentDetails salon={salon} attachment={attachment} />
          <ShareLinksOfFile salon={salon} attachment={attachment} />
          <ToTheFiles salonId={salon.id} />
        </>
      ))
      .exhaustive()
  )
}

/** A file of the salon of the address, for every member of its staff and an administrator. */
export const AttachmentScreen = () => {
  const { salonId = '', attachmentId = '' } = useParams()
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.file)}>
      {(salon) => (
        <AttachmentPart
          key={attachmentId}
          salon={salon}
          attachmentId={attachmentId}
        />
      )}
    </WithSalon>
  )
}
