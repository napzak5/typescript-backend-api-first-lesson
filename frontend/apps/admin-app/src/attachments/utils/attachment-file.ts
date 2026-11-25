import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsAttachmentContentType,
  ModelsAttachmentResponse,
} from '@beauty-salon-frontend/api-client'
import { charactersOf, lengthOf } from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormSays,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminAttachmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import type { AttachmentRemoval, Uploading } from '../api/attachments-api'

/*
 * What a file must be to be uploaded, as the API decides it, how the
 * screens name a file, and who removes one.
 */

const { upload: UPLOAD, removal: REMOVAL } = adminAttachmentMessages
const { errors: ERRORS } = UPLOAD

/** The control of the file to upload */
export const FILE = 'file'

/** The most a file holds: 10 MiB, as the API takes */
const MOST_FILE_SIZE = 10 * 1024 * 1024

/** The longest name a file has, as the API takes */
const MOST_FILENAME_LENGTH = 255

/** The kinds of file the API takes, with the endings of their names */
const KINDS: readonly {
  contentType: ModelsAttachmentContentType
  extensions: readonly string[]
}[] = [
  { contentType: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  { contentType: 'image/png', extensions: ['.png'] },
  { contentType: 'image/webp', extensions: ['.webp'] },
  { contentType: 'application/pdf', extensions: ['.pdf'] },
]

/** What the control of the file offers to choose: the endings of the names, and the types */
export const ACCEPTED_FILES = KINDS.flatMap(({ contentType, extensions }) => [
  ...extensions,
  contentType,
]).join(',')

const CONTENT_TYPE_NAMES: Record<ModelsAttachmentContentType, LocalizedText> =
  termMessages.contentType

/** The kind of a file in words. */
export const contentTypeNameOf = (
  contentType: ModelsAttachmentContentType,
): LocalizedText => CONTENT_TYPE_NAMES[contentType]

/** Whether a file is an image, which the screen shows: every kind but a PDF. */
export const isImage = (contentType: ModelsAttachmentContentType): boolean =>
  contentType !== 'application/pdf'

/** The size of a file in words: 「512 バイト」, 「340 KB」, 「1.2 MB」. */
export const sizeNameOf = (size: number): LocalizedText =>
  formats.fileSizeOf(size)

/**
 * The kind of a file by the ending of its name, in whatever case, after at
 * least one more character, as the API decides it. A browser names the
 * type of a file by its ending as well; what the file holds, the API looks
 * at when the upload is finished.
 */
const contentTypeOf = (
  filename: string,
): ModelsAttachmentContentType | undefined => {
  const name = filename.toLowerCase()

  return KINDS.find(({ extensions }) =>
    extensions.some(
      (extension) => name.length > extension.length && name.endsWith(extension),
    ),
  )?.contentType
}

/** Whether a name holds a character the API refuses: a control character, or one that separates the parts of a path. */
const hasRefusedCharacter = (filename: string): boolean =>
  [...filename].some((character) => {
    // A character outside the basic plane begins with a surrogate, which is neither
    const code = character.charCodeAt(0)

    return (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      character === '/' ||
      character === '\\'
    )
  })

export type ChosenFileRead =
  | { type: 'invalid'; errors: FormErrors<LocalizedText> }
  | {
      type: 'valid'
      file: File
      contentType: ModelsAttachmentContentType
    }

const invalid = (message: LocalizedText): ChosenFileRead => ({
  type: 'invalid',
  errors: { [FILE]: message },
})

/** Why a file of a kind the API takes is refused; `undefined` for one it takes. */
const whyRefused = (file: File): LocalizedText | undefined => {
  if (file.size === 0) {
    return ERRORS.empty
  }
  if (file.size > MOST_FILE_SIZE) {
    return ERRORS.tooLarge(sizeNameOf(file.size))
  }
  if (lengthOf(file.name) > MOST_FILENAME_LENGTH) {
    return ERRORS.nameTooLong(charactersOf(MOST_FILENAME_LENGTH))
  }
  if (hasRefusedCharacter(file.name)) {
    return ERRORS.nameInvalid
  }

  return undefined
}

/**
 * The file chosen in the form, if the API takes it: one of the four kinds
 * by the ending of its name, of 1 byte to 10 MB, with a name of no more
 * than 255 characters and without a control character or a slash.
 */
export const readChosenFile = (file: File | undefined): ChosenFileRead => {
  if (file === undefined) {
    return invalid(ERRORS.missing)
  }
  const contentType = contentTypeOf(file.name)
  if (contentType === undefined) {
    return invalid(ERRORS.type)
  }
  const refused = whyRefused(file)

  return refused === undefined
    ? { type: 'valid', file, contentType }
    : invalid(refused)
}

/** What is said at the control of the file */
const atTheFile = (error: LocalizedText): FormSays<LocalizedText> => ({
  message: undefined,
  errors: { [FILE]: error },
})

/** What the form of the upload says after the API or the storage refused it. */
export const afterUploading = (
  outcome: Exclude<Uploading, { type: 'uploaded' }>,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    // The form sends only what the API takes: a refusal is a salon that was
    // removed meanwhile, or a rule the form does not know of yet
    .with({ type: 'invalid' }, () => atTheFile(ERRORS.refused))
    .with({ type: 'unreadable' }, () => atTheFile(ERRORS.unreadable))
    .with({ type: 'notAsDeclared' }, () => atTheFile(ERRORS.mismatch))
    .with({ type: 'notSent' }, () => aboutTheAttempt(UPLOAD.notSent))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(UPLOAD.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(UPLOAD.failed))
    .exhaustive()

/** The roles that remove every file of their salon: those that remove a booking */
const REMOVERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether an account removes a file: the owner, a manager and an administrator, and whoever uploaded it. */
export const removesAttachment = (
  account: { id: string; role: string },
  attachment: Pick<ModelsAttachmentResponse, 'uploadedBy'>,
): boolean =>
  REMOVERS.includes(account.role) || attachment.uploadedBy === account.id

/** What the dialog of the removal says after the API refused it. */
export const afterRemoving = (
  outcome: Exclude<AttachmentRemoval, { type: 'removed' | 'notFound' }>,
): LocalizedText =>
  match(outcome)
    .returnType<LocalizedText>()
    .with({ type: 'forbidden' }, () => REMOVAL.forbidden)
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS_MESSAGE)
    .with({ type: 'failed' }, () => REMOVAL.failed)
    .exhaustive()

/**
 * Who uploaded a file: the account itself, a member of the staff by the
 * name the ledger has, or another account, which the screen does not name
 * (an administrator, a member removed from the ledger, or the ledger is not
 * read: only the owner and an administrator read it).
 */
export const uploaderNameOf = (
  uploadedBy: string,
  /** The account signed in */
  accountId: string | undefined,
  ledger: readonly { userId: string | null; displayName: string }[],
): LocalizedText => {
  if (uploadedBy === accountId) {
    return adminAttachmentMessages.uploaders.you
  }
  const member = ledger.find(({ userId }) => userId === uploadedBy)

  return member === undefined
    ? adminAttachmentMessages.uploaders.other
    : { en: member.displayName, ja: member.displayName }
}
