import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsAttachmentResponse,
  ModelsSalonResponse,
  ModelsShareLinkCreateRequest,
  ModelsShareLinkResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  type FormSays,
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminAttachmentMessages,
  adminShareLinkMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  attachmentKeyOf,
  attachmentsKeyOf,
  readAttachment,
} from '../../attachments/api/attachments-api'
import { AttachmentNotFound } from '../../attachments/screens/attachment-not-found'
import { attachmentHrefOf, shareLinkHrefOf } from '../../navigation'
import { issueShareLink, shareLinksKeyOf } from '../api/share-links-api'
import {
  type Copying,
  IssuedShareLink,
} from '../components/issued-share-link/issued-share-link'
import { ShareLinkForm } from '../components/share-link-form/share-link-form'
import {
  afterIssuing,
  readShareLinkEntry,
  shareAddressOf,
  sharesFiles,
} from '../utils/share-link'
import { SharingForbidden } from './share-link-notices'

const TITLE = adminShareLinkMessages.titles.entry

/** Puts a text on the clipboard: `false` where the browser does not let the page write there. */
const copied = (text: string): Promise<boolean> =>
  Promise.resolve()
    .then(() => navigator.clipboard.writeText(text))
    .then(
      () => true,
      () => false,
    )

type Issued = { shareLink: ModelsShareLinkResponse; address: string }

type ShareLinkEntryProps = {
  salon: ModelsSalonResponse
  attachment: ModelsAttachmentResponse
}

/**
 * The form of a link of a file, and then the link it issued, in its
 * place: the API gives the token in that answer alone, so the page keeps
 * it while it is open, and nowhere else. The heading of the link takes the
 * focus from the button that went with the form.
 */
const ShareLinkEntry = ({ salon, attachment }: ShareLinkEntryProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copying, setCopying] = useState<Copying>('notCopied')
  const heading = useRef<HTMLHeadingElement>(null)
  const fileHref = attachmentHrefOf(salon.id, attachment.id)

  useLayoutEffect(() => {
    if (issued !== null) {
      heading.current?.focus()
    }
  }, [issued])

  const issue = useMutation({
    mutationFn: (request: ModelsShareLinkCreateRequest) =>
      issueShareLink(attachment.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'issued' }, ({ shareLink, token }) => {
          setIssued({
            shareLink,
            address: shareAddressOf(import.meta.env.VITE_PORTAL_APP_URL, token),
          })
          queryClient.removeQueries({
            queryKey: shareLinksKeyOf(attachment.id),
          })
        })
        // The file was removed meanwhile: it is read anew, and the screen
        // says it is gone
        .with({ type: 'notFound' }, () => {
          queryClient.removeQueries({ queryKey: attachmentsKeyOf(salon.id) })
          void queryClient.invalidateQueries({
            queryKey: attachmentKeyOf(attachment.id),
            exact: true,
          })
        })
        .with(
          {
            type: P.union(
              'invalid',
              'notUploaded',
              'forbidden',
              'tooManyRequests',
              'failed',
            ),
          },
          (refused) => setSaid(afterIssuing(refused)),
        )
        .exhaustive(),
  })

  if (issued !== null) {
    return (
      <IssuedShareLink
        address={issued.address}
        shareLink={issued.shareLink}
        timezone={salon.timezone}
        copying={copying}
        onCopy={() =>
          void copied(issued.address).then((done) =>
            setCopying(done ? 'copied' : 'failed'),
          )
        }
        headingRef={heading}
        shareLinkHref={shareLinkHrefOf(
          salon.id,
          attachment.id,
          issued.shareLink.id,
        )}
        fileHref={fileHref}
      />
    )
  }

  const submit = (values: FormData): void =>
    match(readShareLinkEntry(values, new Date()))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        issue.mutate(value)
      })
      .exhaustive()

  return (
    <ShareLinkForm
      filename={attachment.filename}
      message={said.message}
      errors={said.errors}
      pending={issue.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={fileHref} variant='quiet'>
          {say(adminShareLinkMessages.form.cancel)}
        </ButtonLink>
      }
    />
  )
}

type EntryPartProps = { salon: ModelsSalonResponse; attachmentId: string }

/**
 * The file of the address, read whenever the screen opens: a file of
 * another salon is not found at the address of this one, nor is one whose
 * upload was not finished, as on the screen of the file.
 */
const EntryPart = ({ salon, attachmentId }: EntryPartProps) => {
  const read = useQuery({
    queryKey: attachmentKeyOf(attachmentId),
    queryFn: () => readAttachment(attachmentId),
    staleTime: 0,
  })
  const say = useSay()
  const header = <PageHeader title={say(TITLE)} description={salon.name} />

  return (
    match(read.data)
      .with(undefined, () => (
        <>
          {header}
          <LoadingIndicator label={say(adminAttachmentMessages.loading.file)} />
        </>
      ))
      .with({ type: 'notFound' }, () => (
        <AttachmentNotFound salonId={salon.id} />
      ))
      // The salon is compared by a predicate: as a pattern, a string that is
      // no literal would rule out every file
      .with(
        {
          type: 'found',
          attachment: P.when(({ salonId }) => salonId !== salon.id),
        },
        () => <AttachmentNotFound salonId={salon.id} />,
      )
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <>
          {header}
          <UnreadNotice
            message={say(
              unreadMessageOf(adminAttachmentMessages.names.file, reason),
            )}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .with({ type: 'found' }, ({ attachment }) => (
        <>
          {header}
          <ShareLinkEntry salon={salon} attachment={attachment} />
        </>
      ))
      .exhaustive()
  )
}

/** The issue of a share link of a file of the salon of the address, for its owner, its managers and an administrator. */
export const ShareLinkEntryScreen = () => {
  const { salonId = '', attachmentId = '' } = useParams()
  const session = useSession()
  const shares = session.type === 'signedIn' && sharesFiles(session.user.role)
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(TITLE)}>
      {(salon) =>
        shares ? (
          <EntryPart
            key={attachmentId}
            salon={salon}
            attachmentId={attachmentId}
          />
        ) : (
          <SharingForbidden
            title={say(TITLE)}
            salon={salon}
            attachmentId={attachmentId}
          />
        )
      }
    </WithSalon>
  )
}
