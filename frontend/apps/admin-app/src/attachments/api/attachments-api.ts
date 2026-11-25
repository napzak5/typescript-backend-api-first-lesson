import {
  FAILED,
  type Forbidden,
  from,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  type RefusedValue,
  refusedValuesOf,
  UNANSWERED_PARTS,
  UNREAD_TYPES,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  attachmentCrudComplete,
  attachmentCrudDelete,
  attachmentCrudGet,
  attachmentCrudGetDownloadUrl,
  attachmentCrudGetUploadUrl,
  attachmentCrudList,
  type ModelsAttachmentContentType,
  type ModelsAttachmentResponse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'

/*
 * The files of a salon: photos of before and after a treatment, papers a
 * customer signed. The API keeps what is known of a file; the file itself
 * goes to the object storage and comes from it, at URLs the API signs for a
 * few minutes, which the browser calls without the API.
 */

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The key the files of a salon are listed under: an upload or a removal drops every page. */
export const attachmentsKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'attachments',
]

/** The key a file is read under, with the URLs that open it and save it. */
export const attachmentKeyOf = (attachmentId: string): string[] => [
  'attachment',
  attachmentId.toLowerCase(),
]

const ATTACHMENT_PAGE = 20

/** A file whose upload was finished: the screens show no other, as the list of the API does not */
export type UploadedAttachment = ModelsAttachmentResponse & {
  uploadedAt: string
}

/** The file, when its upload was finished; none while the upload is awaited */
const uploadedIn = (
  attachment: ModelsAttachmentResponse,
): UploadedAttachment[] =>
  attachment.uploadedAt === null
    ? []
    : [{ ...attachment, uploadedAt: attachment.uploadedAt }]

export type AttachmentPage =
  | Page<UploadedAttachment>
  /** The account is a member of another salon */
  | Forbidden
  | Unread

/** A page of the files of a salon whose upload was finished, the latest first. */
export const readAttachmentPage = async (
  salonId: string,
  cursor: string | undefined,
): Promise<AttachmentPage> => {
  const answer = await attachmentCrudList({
    salonId,
    ...from(cursor),
    limit: ATTACHMENT_PAGE,
  }).catch(() => null)

  // A 400 says that the file of the cursor was removed meanwhile: the
  // screens send only what the API takes
  return match(answer)
    .returnType<AttachmentPage>()
    .with({ status: 200 }, ({ data }) =>
      pageOf(data.data.flatMap(uploadedIn), data.meta),
    )
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

export type AttachmentRead =
  | { type: 'found'; attachment: UploadedAttachment }
  /** None has the ID, it was removed, it is of a salon the account does not reach, or its upload is awaited */
  | NotFound
  | Unread

/**
 * A file: one of another salon, one that was removed, or none, is not
 * found, and neither is one whose upload is awaited, which the list does
 * not have either.
 */
export const readAttachment = async (
  attachmentId: string,
): Promise<AttachmentRead> => {
  const answer = await attachmentCrudGet(attachmentId).catch(() => null)

  // A 403 is the answer to an account of no salon, which the screens are not for
  return match(answer)
    .returnType<AttachmentRead>()
    .with({ status: 200 }, ({ data }) =>
      match(uploadedIn(data.data))
        .returnType<AttachmentRead>()
        .with([P.select()], (attachment) => ({ type: 'found', attachment }))
        .otherwise(() => NOT_FOUND),
    )
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

type DownloadRead =
  | { type: 'issued'; url: string }
  /** The file was removed meanwhile */
  | NotFound
  | Unread

/** A URL of the storage that answers the file for five minutes: shown in the browser (`inline`), or saved under the name it was uploaded with. */
const readDownloadUrl = async (
  attachmentId: string,
  inline: boolean,
): Promise<DownloadRead> => {
  const answer = await attachmentCrudGetDownloadUrl(attachmentId, {
    inline,
  }).catch(() => null)

  // A 409 is a file whose upload was not finished, which no screen shows
  return match(answer)
    .returnType<DownloadRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'issued',
      url: data.data.downloadUrl,
    }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: P.union(403, 409) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

export type FileLinksRead =
  | { type: 'issued'; open: string; save: string }
  /** The file was removed meanwhile */
  | NotFound
  | Unread

/**
 * The URLs of the storage that open a file in a tab and save it under its
 * name, asked for together: they last as long, and are read anew together.
 */
export const readFileLinks = async (
  attachmentId: string,
): Promise<FileLinksRead> => {
  const read = await Promise.all([
    readDownloadUrl(attachmentId, true),
    readDownloadUrl(attachmentId, false),
  ])

  return match(read)
    .returnType<FileLinksRead>()
    .with([{ type: 'issued' }, { type: 'issued' }], ([open, save]) => ({
      type: 'issued',
      open: open.url,
      save: save.url,
    }))
    .with(
      P.union([{ type: 'notFound' }, P._], [P._, { type: 'notFound' }]),
      () => NOT_FOUND,
    )
    .with([{ type: P.union(...UNREAD_TYPES) }, P._], ([unread]) => unread)
    .with([P._, { type: P.union(...UNREAD_TYPES) }], ([, unread]) => unread)
    .exhaustive()
}

/** A file chosen to upload, and its kind by the ending of its name */
export type ChosenUpload = {
  file: File
  contentType: ModelsAttachmentContentType
}

export type Uploading =
  | { type: 'uploaded'; attachment: ModelsAttachmentResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The browser could not read the file: it was moved or changed after it was chosen */
  | { type: 'unreadable' }
  /** The storage did not take the file: it was not sent, and can be again */
  | { type: 'notSent' }
  /** The storage has the file, but it is not what its type says: the API removed it */
  | { type: 'notAsDeclared' }
  /** The account is a member of another salon */
  | Forbidden
  | Unread

/** What the API answered to the request of the URL, when it gave none */
type NotIssued = Exclude<
  Uploading,
  { type: 'uploaded' | 'notAsDeclared' | 'unreadable' }
>

/** Asks for the URL that the file is sent to: the name, the kind and the size of the file are told. */
const issueUpload = async (
  salonId: string,
  { file, contentType }: ChosenUpload,
  size: number,
) => {
  const answer = await attachmentCrudGetUploadUrl({
    filename: file.name,
    contentType,
    size,
    salonId,
  }).catch(() => null)

  return match(answer)
    .returnType<
      | {
          type: 'issued'
          id: string
          url: string
          headers: Record<string, string>
        }
      | NotIssued
    >()
    .with({ status: 201 }, ({ data }) => ({
      type: 'issued',
      id: data.data.attachment.id,
      url: data.data.uploadUrl,
      headers: data.data.uploadHeaders,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * Sends the file to the storage, at the URL the API signed for it, with the
 * headers the signature holds. The request goes to the storage, not to the
 * API, so it carries no token of the session.
 */
const sendToStorage = async (
  url: string,
  headers: Record<string, string>,
  bytes: ArrayBuffer,
): Promise<boolean> => {
  const answer = await fetch(url, {
    method: 'PUT',
    headers,
    body: bytes,
  }).catch(() => null)

  return answer?.ok === true
}

/** Tells the API that the file was sent: it looks at it, and lists it. */
const completeUpload = async (attachmentId: string): Promise<Uploading> => {
  const answer = await attachmentCrudComplete(attachmentId).catch(() => null)

  // A 404 is a file removed while it was sent, a 409 one that is not what
  // its type says, or that the storage does not have
  return match(answer)
    .returnType<Uploading>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'uploaded',
      attachment: data.data,
    }))
    .with({ status: 409 }, () => ({ type: 'notAsDeclared' }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(400, 404) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * Uploads a file to the files of a salon: the file is read, the URL asked
 * for, the file sent to it, and the upload finished, one after the other.
 * A file that is not sent stays unfinished, out of every list, and the API
 * clears it away.
 */
export const uploadAttachment = async (
  salonId: string,
  chosen: ChosenUpload,
): Promise<Uploading> => {
  const bytes = await chosen.file.arrayBuffer().catch(() => null)
  if (bytes === null) {
    return { type: 'unreadable' }
  }
  const issued = await issueUpload(salonId, chosen, bytes.byteLength)
  if (issued.type !== 'issued') {
    return issued
  }
  const sent = await sendToStorage(issued.url, issued.headers, bytes)
  if (!sent) {
    return { type: 'notSent' }
  }

  return completeUpload(issued.id)
}

export type AttachmentRemoval =
  | { type: 'removed' }
  /** The file was removed meanwhile */
  | NotFound
  /** The account removes only the files it uploaded */
  | Forbidden
  | Unread

/** Removes a file: it is gone from the storage, and from every list. */
export const removeAttachment = async (
  attachmentId: string,
): Promise<AttachmentRemoval> => {
  const answer = await attachmentCrudDelete(attachmentId).catch(() => null)

  return match(answer)
    .returnType<AttachmentRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}
