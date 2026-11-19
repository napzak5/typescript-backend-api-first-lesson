import type {
  ModelsAuthPasswordChangeRequest,
  ModelsSessionResponse,
} from '@beauty-salon-frontend/api-client'
import type { FormErrors } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { newPasswordError, refusedPasswordMessage } from './password-rule'
import type {
  PasswordChange,
  RefusedValue,
  SessionPage,
  Unsent,
} from './security-api'

/*
 * What the screens of the security of an account make of what a person
 * entered, and of the answers of the API.
 */

/** What a form was sent with: a value to send on, or what is wrong with it. */
export type Read<Value> =
  | { type: 'valid'; value: Value }
  | { type: 'invalid'; errors: FormErrors }

/** What a form says about the last attempt: about the whole of it, and at its controls. */
export type FormSays = {
  message: string | undefined
  errors: FormErrors
}

export const NOTHING_TO_SAY: FormSays = { message: undefined, errors: {} }

/** The names of the controls of the form: those of the properties of the request. */
export const CURRENT_PASSWORD = 'currentPassword'
export const NEW_PASSWORD = 'newPassword'

const CURRENT_PASSWORD_MISSING = '現在のパスワードを入力してください。'
const CURRENT_PASSWORD_WRONG =
  '現在のパスワードが違います。5 回続けて違うと、15 分間、サインインもできなくなります。'
const UNCHANGED =
  '現在のパスワードと同じです。別のパスワードを入力してください。'
const TOO_MANY_REQUESTS =
  'アクセスが多すぎます。しばらくしてから、もう一度お試しください。'
const NOT_SENT =
  '送信できませんでした。通信の状態を確かめて、もう一度お試しください。'

const textOf = (values: FormData, name: string): string => {
  const value = values.get(name)

  return typeof value === 'string' ? value : ''
}

/**
 * Reads the form that changes the password. Both passwords are taken as
 * they were typed: a space is a character of a password. The new one is
 * checked against the rule, and against the current one as the API
 * compares them, after both are normalized.
 */
export const readPasswordChange = (
  values: FormData,
): Read<ModelsAuthPasswordChangeRequest> => {
  const currentPassword = textOf(values, CURRENT_PASSWORD)
  const newPassword = textOf(values, NEW_PASSWORD)
  const errors: FormErrors = {
    [CURRENT_PASSWORD]:
      currentPassword === '' ? CURRENT_PASSWORD_MISSING : undefined,
    [NEW_PASSWORD]:
      newPasswordError(newPassword) ??
      (newPassword.normalize('NFC') === currentPassword.normalize('NFC')
        ? UNCHANGED
        : undefined),
  }

  return Object.values(errors).some((error) => error !== undefined)
    ? { type: 'invalid', errors }
    : { type: 'valid', value: { currentPassword, newPassword } }
}

/** What to say at the control of a value the API did not take; `undefined` when the form has none for it. */
const messageOf = ({ field, rule }: RefusedValue): string | undefined =>
  match(field)
    .with(CURRENT_PASSWORD, () => CURRENT_PASSWORD_WRONG)
    .with(NEW_PASSWORD, () =>
      rule === 'unchanged' ? UNCHANGED : refusedPasswordMessage(rule),
    )
    .otherwise(() => undefined)

/**
 * What the form says after the API did not change the password: at the
 * control of each value it named, and about the attempt when it named none
 * the form has. What was typed stays, to be corrected.
 */
export const afterPasswordChange = (
  outcome: Exclude<PasswordChange, { type: 'changed' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value): [string, string][] => {
        const message = messageOf(value)

        return message === undefined ? [] : [[value.field, message]]
      })

      return said.length === 0
        ? {
            message: '入力した内容を確かめて、もう一度お試しください。',
            errors: {},
          }
        : { message: undefined, errors: Object.fromEntries(said) }
    })
    .with({ type: 'tooManyRequests' }, () => ({
      message: TOO_MANY_REQUESTS,
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({ message: NOT_SENT, errors: {} }))
    .exhaustive()

/** What the screen says when a request that changes nothing a person typed got nowhere. */
export const afterUnsent = (outcome: Unsent): string =>
  match(outcome)
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => NOT_SENT)
    .exhaustive()

/** What the screen says when it could not read something. */
export const unreadMessageOf = (what: string, reason: Unsent): string =>
  reason.type === 'tooManyRequests'
    ? TOO_MANY_REQUESTS
    : `${what}を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。`

/** What comes after the sessions that are shown, for the list that shows them. */
export type More = 'none' | 'available' | 'loading' | 'failed'

/** What the pages of the sessions that were read so far amount to. */
export type SessionListing =
  /** Nothing is there to show: the first page was not read */
  | { type: 'unread'; reason: Unsent }
  | {
      type: 'listed'
      sessions: ModelsSessionResponse[]
      /** How many sessions the account has; `null` when the API did not count them */
      total: number | null
      /**
       * What comes after the sessions: nothing, a page that was not asked
       * for yet (`more`), or one that was asked for and not read
       * (`unread`): a page whose cursor had gone is one, until the list is
       * read again from its start
       */
      rest: 'none' | 'more' | 'unread'
    }

const FAILED: Unsent = { type: 'failed' }

/**
 * Puts the pages that were read together. A page that was not read ends the
 * list where it is: what was read before it stays, and the list says that
 * something is missing.
 */
export const listingOf = (pages: readonly SessionPage[]): SessionListing => {
  const [first] = pages
  const last = pages.at(-1)
  if (first === undefined || last === undefined) {
    return { type: 'unread', reason: FAILED }
  }
  if (first.type !== 'found') {
    return {
      type: 'unread',
      reason: first.type === 'cursorGone' ? FAILED : first,
    }
  }
  const read = pages.flatMap((page) => (page.type === 'found' ? [page] : []))

  return {
    type: 'listed',
    sessions: read.flatMap((page) => page.sessions),
    total: read.at(-1)?.total ?? null,
    rest:
      last.type !== 'found'
        ? 'unread'
        : last.nextCursor === null
          ? 'none'
          : 'more',
  }
}

/** Where the page after one begins, for the query that reads the pages. */
export const cursorAfter = (page: SessionPage): string | undefined =>
  page.type === 'found' ? (page.nextCursor ?? undefined) : undefined

/** The cursor of the first page: there is none. */
export const firstCursor = (): string | undefined => undefined

/** Whether the page that was read last could not be read because its cursor had gone. */
export const endsWithGoneCursor = (pages: readonly SessionPage[]): boolean =>
  pages.at(-1)?.type === 'cursorGone'

/**
 * What the button below the list does, and whether there is one. A page
 * that was not read is asked for again by reading the list again, so it is
 * on its way while the list is.
 */
export const moreOf = (
  rest: 'none' | 'more' | 'unread',
  fetching: { nextPage: boolean; again: boolean },
): More => {
  if (rest === 'none') {
    return 'none'
  }
  if (fetching.nextPage || (rest === 'unread' && fetching.again)) {
    return 'loading'
  }

  return rest === 'unread' ? 'failed' : 'available'
}

/**
 * The pages without a session that was ended: it leaves the list at once,
 * and the count with it, which every page carries. Where the next page
 * begins stays as the API said; the list is read again behind what it
 * shows. Pages that no longer show the session (they were read again in
 * the meantime) stay as they are.
 */
export const withoutSession = (
  pages: readonly SessionPage[],
  sessionId: string,
): SessionPage[] => {
  const shown = pages.some(
    (page) =>
      page.type === 'found' && page.sessions.some(({ id }) => id === sessionId),
  )

  return pages.map((page) =>
    shown && page.type === 'found'
      ? {
          ...page,
          sessions: page.sessions.filter(({ id }) => id !== sessionId),
          total: page.total === null ? null : page.total - 1,
        }
      : page,
  )
}
