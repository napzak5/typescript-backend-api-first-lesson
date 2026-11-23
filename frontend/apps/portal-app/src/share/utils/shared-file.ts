import {
  NOT_SENT_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
  type Unread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsAttachmentContentType,
  ModelsSharedFileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { bytesOf, fileSizeOf } from '@beauty-salon-shared/i18n/formats'
import { portalShareMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'

/*
 * What the screen of a share link says of the file and of what became of a
 * request, apart from the screen.
 */

const { file: words, password: passwordWords } = portalShareMessages

const CONTENT_TYPE_NAMES: Record<ModelsAttachmentContentType, LocalizedText> =
  termMessages.contentType

/** Whether a file is an image, which the screen shows: every kind but a PDF. */
export const isImage = (contentType: ModelsAttachmentContentType): boolean =>
  contentType !== 'application/pdf'

const KILOBYTE = 1024

/**
 * The size of a file in words, and in bytes when the words round it:
 * 「512 バイト」, 「340 KB（348,160 バイト）」, 「1.2 MB（1,258,291 バイト）」.
 */
export const sizeNameOf = (size: number): LocalizedText =>
  size < KILOBYTE
    ? bytesOf(size)
    : words.sizeOf(fileSizeOf(size), bytesOf(size))

/** What is said of the file before it is loaded */
export const factsOf = (
  file: ModelsSharedFileResponse,
): { term: LocalizedText; description: LocalizedText }[] => [
  { term: words.kind, description: CONTENT_TYPE_NAMES[file.contentType] },
  { term: words.size, description: sizeNameOf(file.size) },
]

/**
 * The password the form was sent with. It is held to no rule but that there
 * is one: whoever opens the link does not know those the link was made
 * with, and the API says whether it is the one.
 */
export const readPassword = (
  values: FormData,
): FormRead<string, FormErrors<LocalizedText>> => {
  const password = values.get('password')

  return typeof password === 'string' && password !== ''
    ? { type: 'valid', value: password }
    : { type: 'invalid', errors: { password: passwordWords.missing } }
}

/** What the form of the password says when the API did not open the file with it */
export const afterPassword = (
  refusal: { type: 'passwordRefused' } | Unread,
): FormSays<LocalizedText> =>
  match(refusal)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'passwordRefused' }, () => ({
      message: undefined,
      errors: { password: passwordWords.refused },
    }))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(NOT_SENT_MESSAGE))
    .exhaustive()

/** What is said when a request was not answered, or the file not fetched */
export const loadMessageOf = (
  reason: Unread | { type: 'notFetched' },
): LocalizedText =>
  match(reason)
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS_MESSAGE)
    .with({ type: 'failed' }, () => words.notLoaded)
    .with({ type: 'notFetched' }, () => words.notFetched)
    .exhaustive()
