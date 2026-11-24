import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  EmptyState,
  type FormSays,
  LoadingIndicator,
  moreOf,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminAttachmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { attachmentHrefOf } from '../../navigation'
import {
  attachmentsKeyOf,
  type ChosenUpload,
  readAttachmentPage,
  uploadAttachment,
} from '../api/attachments-api'
import { AttachmentTable } from '../components/attachment-table/attachment-table'
import { AttachmentUpload } from '../components/attachment-upload/attachment-upload'
import { useUploaderName } from '../hooks/use-uploader-name'
import { afterUploading, readChosenFile } from '../utils/attachment-file'

const { titles, names, loading } = adminAttachmentMessages

/**
 * The form of an upload. The file chosen is kept as it is chosen, and
 * checked as the API checks it when the form is sent. After an upload the
 * form is empty again for the next file, and its heading takes the focus;
 * the list is read anew, with the file first.
 */
const UploadPart = ({ salonId }: { salonId: string }) => {
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [chosen, setChosen] = useState<File | undefined>(undefined)
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  /** How many files were uploaded: the form is drawn anew, empty, after each */
  const [uploads, setUploads] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    if (uploads > 0) {
      heading.current?.focus()
    }
  }, [uploads])

  const upload = useMutation({
    mutationFn: (request: ChosenUpload) => uploadAttachment(salonId, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'uploaded' }, ({ attachment }) => {
          setChosen(undefined)
          setSaid(NOTHING_TO_SAY)
          setUploads((count) => count + 1)
          void queryClient.invalidateQueries({
            queryKey: attachmentsKeyOf(salonId),
          })
          notify({
            tone: 'success',
            message: adminAttachmentMessages.upload.done(attachment.filename),
          })
        })
        .with(
          {
            type: P.union(
              'invalid',
              'unreadable',
              'notSent',
              'notAsDeclared',
              'forbidden',
              'tooManyRequests',
              'failed',
            ),
          },
          (refused) => setSaid(afterUploading(refused)),
        )
        .exhaustive(),
  })

  const submit = (): void =>
    match(readChosenFile(chosen))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ file, contentType }) => {
        setSaid(NOTHING_TO_SAY)
        upload.mutate({ file, contentType })
      })
      .exhaustive()

  return (
    <AttachmentUpload
      key={uploads}
      headingRef={heading}
      message={said.message}
      errors={said.errors}
      pending={upload.isPending}
      onSubmit={submit}
      onChoose={(file) => {
        setChosen(file)
        setSaid(NOTHING_TO_SAY)
      }}
    />
  )
}

/**
 * The files of a salon, the latest uploaded first, and the form that adds
 * one. A member of another salon is told that the files are not theirs to
 * see, without the form.
 */
const AttachmentsPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const uploaderName = useUploaderName(salon.id)
  const read = useInfiniteQuery({
    queryKey: [...attachmentsKeyOf(salon.id), 'list'],
    queryFn: ({ pageParam }) => readAttachmentPage(salon.id, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Every member of the staff uploads and removes files: the list is read whenever it is shown
    staleTime: 0,
  })

  const pages = read.data?.pages ?? []
  if (pages[0]?.type === 'forbidden') {
    return (
      <>
        <PageHeader title={say(titles.files)} description={salon.name} />
        <OtherSalonNotice what={names.filesOfTheSalon} />
      </>
    )
  }

  return (
    <>
      <PageHeader title={say(titles.files)} description={salon.name} />
      <UploadPart salonId={salon.id} />
      {match(
        read.data === undefined
          ? undefined
          : listingOf(
              // A page after the first is refused only when the account
              // moved meanwhile: it ends the list there
              pages.map((page) => (page.type === 'forbidden' ? FAILED : page)),
            ),
      )
        .with(undefined, () => <LoadingIndicator label={say(loading.files)} />)
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.files, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState
            title={say(adminAttachmentMessages.none)}
            description={say(adminAttachmentMessages.noneDescription)}
          />
        ))
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <AttachmentTable
            attachments={items}
            timezone={salon.timezone}
            uploaderName={uploaderName}
            attachmentHref={(id) => attachmentHrefOf(salon.id, id)}
            total={total}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The files of the salon of the address, for every member of its staff and an administrator. */
export const AttachmentsScreen = () => {
  const { salonId = '' } = useParams()
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.files)}>
      {(salon) => <AttachmentsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
