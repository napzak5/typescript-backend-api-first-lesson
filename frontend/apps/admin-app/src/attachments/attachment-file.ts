import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsAttachmentContentType,
  ModelsAttachmentResponse,
} from '@beauty-salon-frontend/api-client'
import type { FormErrors } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { type FormSays, TOO_MANY_REQUESTS } from '../bookings/booking-entry'
import type { AttachmentRemoval, Uploading } from './attachments-api'

/*
 * What a file must be to be uploaded, as the API decides it, how the
 * screens name a file, and who removes one.
 */

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

/** The kind of a file in words. */
export const contentTypeNameOf = (
  contentType: ModelsAttachmentContentType,
): string =>
  match(contentType)
    .with('image/jpeg', () => 'JPEG 画像')
    .with('image/png', () => 'PNG 画像')
    .with('image/webp', () => 'WebP 画像')
    .with('application/pdf', () => 'PDF')
    .exhaustive()

/** Whether a file is an image, which the screen shows: every kind but a PDF. */
export const isImage = (contentType: ModelsAttachmentContentType): boolean =>
  contentType !== 'application/pdf'

const KILOBYTE = 1024
const MEGABYTE = 1024 * 1024

/** The size of a file in words: 「512 バイト」, 「340 KB」, 「1.2 MB」. */
export const sizeNameOf = (size: number): string => {
  if (size < KILOBYTE) {
    return `${size} バイト`
  }
  if (size < MEGABYTE) {
    return `${Math.round(size / KILOBYTE)} KB`
  }

  return `${(size / MEGABYTE).toFixed(1)} MB`
}

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
    const code = character.codePointAt(0) ?? 0

    return (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      character === '/' ||
      character === '\\'
    )
  })

export type ChosenFileRead =
  | { type: 'invalid'; errors: FormErrors }
  | {
      type: 'valid'
      file: File
      contentType: ModelsAttachmentContentType
    }

const invalid = (message: string): ChosenFileRead => ({
  type: 'invalid',
  errors: { [FILE]: message },
})

/** Why a file of a kind the API takes is refused; `undefined` for one it takes. */
const whyRefused = (file: File): string | undefined => {
  if (file.size === 0) {
    return '中身のないファイルです。ほかのファイルを選んでください。'
  }
  if (file.size > MOST_FILE_SIZE) {
    return `ファイルが大きすぎます（${sizeNameOf(file.size)}）。10 MB までのファイルを選んでください。`
  }
  if (file.name.length > MOST_FILENAME_LENGTH) {
    return 'ファイル名が長すぎます。255 文字までの名前にしてから、選んでください。'
  }
  if (hasRefusedCharacter(file.name)) {
    return 'ファイル名に、使えない文字が入っています。名前を変えてから、選んでください。'
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
    return invalid('アップロードするファイルを選んでください。')
  }
  const contentType = contentTypeOf(file.name)
  if (contentType === undefined) {
    return invalid('JPEG、PNG、WebP の画像か、PDF のファイルを選んでください。')
  }
  const refused = whyRefused(file)

  return refused === undefined
    ? { type: 'valid', file, contentType }
    : invalid(refused)
}

/** What the form of the upload says after the API or the storage refused it. */
export const afterUploading = (
  outcome: Exclude<Uploading, { type: 'uploaded' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    // The form sends only what the API takes: a refusal is a salon that was
    // removed meanwhile, or a rule the form does not know of yet
    .with({ type: 'invalid' }, () => ({
      message: undefined,
      errors: {
        [FILE]:
          'このファイルは、アップロードできませんでした。ファイルの種類、大きさ、名前を確かめてください。',
      },
    }))
    .with({ type: 'unreadable' }, () => ({
      message: undefined,
      errors: {
        [FILE]:
          'ファイルを読めませんでした。選んだあとで、ファイルが移されたか、変えられたのかもしれません。もう一度選んでください。',
      },
    }))
    .with({ type: 'notAsDeclared' }, () => ({
      message: undefined,
      errors: {
        [FILE]:
          'ファイルの中身が、名前の拡張子の種類と合いませんでした。中身と拡張子の合うファイルを選んでください。',
      },
    }))
    .with({ type: 'notSent' }, () => ({
      message:
        'ファイルを送れませんでした。通信の状態を確かめて、もう一度アップロードしてください。',
      errors: {},
    }))
    .with({ type: 'forbidden' }, () => ({
      message:
        'このアカウントでは、このサロンにファイルを置けません。置けるのは、このサロンのスタッフと、管理者です。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        'ファイルをアップロードできませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()

/** The roles that remove every file of their salon: those that remove a booking */
const REMOVERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether an account removes a file: the owner, a manager and an administrator, and whoever uploaded it. */
export const removesAttachment = (
  account: { id: string; role: string },
  attachment: Pick<ModelsAttachmentResponse, 'uploadedBy'>,
): boolean =>
  REMOVERS.includes(account.role) || attachment.uploadedBy === account.id

/** Who may remove a file that the account may not: said in place of the button. */
export const REMOVAL_NOTE =
  'このファイルを削除できるのは、アップロードした人と、サロンのオーナー、マネージャー、管理者です。'

/** What the dialog of the removal says after the API refused it. */
export const afterRemoving = (
  outcome: Exclude<AttachmentRemoval, { type: 'removed' | 'notFound' }>,
): string =>
  match(outcome)
    .with({ type: 'forbidden' }, () => REMOVAL_NOTE)
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS_MESSAGE)
    .with(
      { type: 'failed' },
      () =>
        'ファイルを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    .exhaustive()

/**
 * Who uploaded a file: the account itself, a member of the staff by the
 * name the ledger has, or another account, which the screen does not name
 * (an administrator, a member removed from the ledger, or the ledger is not
 * read: only the owner and an administrator read it).
 */
export const uploaderNameOf = (
  uploadedBy: string,
  accountId: string,
  ledger: readonly { userId: string | null; displayName: string }[],
): string => {
  if (uploadedBy === accountId) {
    return 'あなた'
  }

  return (
    ledger.find(({ userId }) => userId === uploadedBy)?.displayName ??
    'ほかのアカウント'
  )
}
