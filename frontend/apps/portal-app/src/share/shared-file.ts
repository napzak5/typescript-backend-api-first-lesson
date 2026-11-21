import type {
  ModelsAttachmentContentType,
  ModelsSharedFileResponse,
} from '@beauty-salon-frontend/api-client'
import { match } from 'ts-pattern'
import type { FormSays, Read } from '../forms'
import type { Unread } from '../salons/salons-api'

/*
 * What the screen of a share link says of the file and of what became of a
 * request, apart from the screen.
 */

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

/**
 * The size of a file in words, and in bytes when the words round it:
 * 「512 バイト」, 「340 KB（348,160 バイト）」, 「1.2 MB（1,258,291 バイト）」.
 */
export const sizeNameOf = (size: number): string => {
  if (size < KILOBYTE) {
    return `${size} バイト`
  }
  const rounded =
    size < MEGABYTE
      ? `${Math.round(size / KILOBYTE)} KB`
      : `${(size / MEGABYTE).toFixed(1)} MB`

  return `${rounded}（${size.toLocaleString('ja-JP')} バイト）`
}

/** What is said of the file before it is loaded */
export const factsOf = (
  file: ModelsSharedFileResponse,
): { term: string; description: string }[] => [
  { term: '種類', description: contentTypeNameOf(file.contentType) },
  { term: 'サイズ', description: sizeNameOf(file.size) },
]

/** Said where the file is loaded: the link counts every load */
export const LOAD_NOTE =
  'ファイルを読み込むたびに、ダウンロードを 1 回と数えます。共有リンクにダウンロードの回数の上限があるときは、残りの回数が 1 回減ります。読み込んだファイルは、このページを開いているあいだ、何度でも見て、保存できます。'

/** Said at the password when the API did not take it */
const PASSWORD_REFUSED_SAID =
  'パスワードが違うか、5 回続けて間違えたために、15 分のあいだ使えなくなっています。確かめて、もう一度入力してください。'

/** Said when the password is asked for again, after the API refused the one that opened the file */
export const PASSWORD_AGAIN_SAID =
  'パスワードを、もう一度入力してください。ほかの人が続けて間違えたために、しばらく使えなくなっていることがあります。'

/** Said at the password when it is sent empty */
const PASSWORD_MISSING_SAID = 'パスワードを入力してください。'

const TOO_MANY_REQUESTS =
  'アクセスが多すぎます。しばらくしてから、もう一度お試しください。'

/**
 * The password the form was sent with. It is held to no rule but that there
 * is one: whoever opens the link does not know those the link was made
 * with, and the API says whether it is the one.
 */
export const readPassword = (values: FormData): Read<string> => {
  const password = values.get('password')

  return typeof password === 'string' && password !== ''
    ? { type: 'valid', value: password }
    : { type: 'invalid', errors: { password: PASSWORD_MISSING_SAID } }
}

/** What the form of the password says when the API did not open the file with it */
export const afterPassword = (
  refusal: { type: 'passwordRefused' } | Unread,
): FormSays =>
  match(refusal)
    .with({ type: 'passwordRefused' }, () => ({
      message: undefined,
      errors: { password: PASSWORD_REFUSED_SAID },
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      message: TOO_MANY_REQUESTS,
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()

/** What is said when a request was not answered, or the file not fetched */
export const loadMessageOf = (
  reason: Unread | { type: 'notFetched' },
): string =>
  match(reason)
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with(
      { type: 'failed' },
      () =>
        'ファイルを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    .with(
      { type: 'notFetched' },
      () =>
        'ファイルを読み込めませんでした。ダウンロードの回数は 1 回と数えられています。もう一度読み込むと、もう 1 回と数えます。',
    )
    .exhaustive()

/** Why a share link may work no more: the API does not say which */
export const UNUSABLE_SAID =
  '有効期限が過ぎたか、ダウンロードの回数の上限に達したか、共有が取り消されたか、ファイルが削除されています。必要なときは、共有したサロンにお問い合わせください。'

/** Said on a page that has no token: it was loaded again, or typed */
export const NO_TOKEN_SAID =
  'このページは、受け取った共有リンクから開いてください。ページを読み込み直したときも、受け取ったリンクから、もう一度開いてください。'
