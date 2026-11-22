import type {
  ModelsSessionResponse,
  ModelsTwoFactorStatusType,
  ModelsUserResponse,
} from '@beauty-salon-frontend/api-client'
import { match } from 'ts-pattern'

/*
 * How the screens of the security of an account say what the API keeps.
 * An account belongs to no salon, so a moment is said in the time zone of
 * whoever reads (the screens hand over that of the browser).
 */

/** A moment, as 「2026年11月20日 10:15」. */
export const momentOf = (instant: string, timeZone: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(instant))

/** When the password was changed last, or that it never was. */
export const passwordChangedOf = (
  { lastPasswordChange }: Pick<ModelsUserResponse, 'lastPasswordChange'>,
  timeZone: string,
): string =>
  lastPasswordChange === null
    ? 'アカウントを作ってから、変更していません'
    : momentOf(lastPasswordChange, timeZone)

/** What the two-factor authentication of the account is, in a word and in a sentence. */
export type TwoFactorState = {
  label: string
  tone: 'success' | 'warning' | 'neutral'
  description: string
}

export const twoFactorStateOf = (
  status: ModelsTwoFactorStatusType,
): TwoFactorState =>
  match(status)
    .returnType<TwoFactorState>()
    .with('enabled', () => ({
      label: '有効',
      tone: 'success',
      description:
        'サインインのときに、パスワードに加えて、認証アプリが表示するコードを確かめます。',
    }))
    .with('pending', () => ({
      label: '設定の途中',
      tone: 'warning',
      description:
        '設定を始めましたが、認証アプリのコードで確かめていません。サインインのときに、コードは求められません。',
    }))
    .with('disabled', () => ({
      label: '未設定',
      tone: 'neutral',
      description:
        'サインインのときに確かめるのは、パスワードだけです。認証アプリのコードも確かめると、パスワードが知られても、サインインされません。',
    }))
    .exhaustive()

/**
 * How a session is named: by when its device signed in. A person tells
 * their devices apart by what they did, and the API knows no name for one.
 */
export const sessionNameOf = (
  { createdAt }: Pick<ModelsSessionResponse, 'createdAt'>,
  timeZone: string,
): string => `${momentOf(createdAt, timeZone)} にサインインした端末`

/** What the API kept of the browser of a session: the User-Agent it sent, as it is. */
export const browserOf = ({
  userAgent,
}: Pick<ModelsSessionResponse, 'userAgent'>): string =>
  userAgent ?? '記録されていません'

/** Where a session signed in from. */
export const addressOf = ({
  ipAddress,
}: Pick<ModelsSessionResponse, 'ipAddress'>): string =>
  ipAddress ?? '記録されていません'
