import {
  CHECK_THE_VALUES_MESSAGE,
  cursorAfter as cursorAfterPage,
  FAILED,
  type Listing,
  listingOf as listingOfPages,
  NOT_SENT_MESSAGE,
  type Page,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
  type Unread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsAuthPasswordChangeRequest,
  ModelsSessionResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import type { PasswordChange, SessionPage } from '../api/security-api'
import { newPasswordError, refusedPasswordMessage } from './password-rule'

/*
 * What the screens of the security of an account make of what a person
 * entered, and of the answers of the API.
 */
/** The names of the controls of the form: those of the properties of the request. */
export const CURRENT_PASSWORD = 'currentPassword'
export const NEW_PASSWORD = 'newPassword'

const { password } = securityMessages
/**
 * Reads the form that changes the password. Both passwords are taken as
 * they were typed: a space is a character of a password. The new one is
 * checked against the rule, and against the current one as the API
 * compares them, after both are normalized.
 */
export const readPasswordChange = (
  values: FormData,
): FormRead<ModelsAuthPasswordChangeRequest, FormErrors<LocalizedText>> => {
  const currentPassword = textOf(values, CURRENT_PASSWORD)
  const newPassword = textOf(values, NEW_PASSWORD)
  const errors: FormErrors<LocalizedText> = {
    [CURRENT_PASSWORD]:
      currentPassword === '' ? password.currentMissing : undefined,
    [NEW_PASSWORD]:
      newPasswordError(newPassword) ??
      (newPassword.normalize('NFC') === currentPassword.normalize('NFC')
        ? password.unchanged
        : undefined),
  }

  return Object.values(errors).some((error) => error !== undefined)
    ? { type: 'invalid', errors }
    : { type: 'valid', value: { currentPassword, newPassword } }
}

/** What to say at the control of a value the API did not take; `undefined` when the form has none for it. */
const messageOf = ({ field, rule }: RefusedValue): LocalizedText | undefined =>
  match(field)
    .with(CURRENT_PASSWORD, () => password.currentWrong)
    .with(NEW_PASSWORD, () =>
      rule === 'unchanged' ? password.unchanged : refusedPasswordMessage(rule),
    )
    .otherwise(() => undefined)

/**
 * What the form says after the API did not change the password: at the
 * control of each value it named, and about the attempt when it named none
 * the form has. What was typed stays, to be corrected.
 */
export const afterPasswordChange = (
  outcome: Exclude<PasswordChange, { type: 'changed' }>,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value): [string, LocalizedText][] => {
        const message = messageOf(value)

        return message === undefined ? [] : [[value.field, message]]
      })

      return said.length === 0
        ? aboutTheAttempt(CHECK_THE_VALUES_MESSAGE)
        : { message: undefined, errors: Object.fromEntries(said) }
    })
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(NOT_SENT_MESSAGE))
    .exhaustive()

/** What the pages of the sessions that were read so far amount to. */
export type SessionListing = Listing<ModelsSessionResponse>

/**
 * A page of the sessions as the list reads it: one whose cursor had gone
 * was not read, until the list is read again from its start.
 */
const asRead = (page: SessionPage): Page<ModelsSessionResponse> | Unread =>
  page.type === 'cursorGone' ? FAILED : page

/** Puts the pages that were read together, as every list does. */
export const listingOf = (pages: readonly SessionPage[]): SessionListing =>
  listingOfPages(pages.map(asRead))

/** Where the page after one begins, for the query that reads the pages. */
export const cursorAfter = (page: SessionPage): string | undefined =>
  cursorAfterPage(asRead(page))

/** Whether the page that was read last could not be read because its cursor had gone. */
export const endsWithGoneCursor = (pages: readonly SessionPage[]): boolean =>
  pages.at(-1)?.type === 'cursorGone'

/** What was read of the sessions, without a session that was ended; nothing when nothing was read. */
export const withoutSessionIn = <Read extends { pages: SessionPage[] }>(
  read: Read | undefined,
  sessionId: string,
): Read | undefined =>
  read === undefined
    ? read
    : { ...read, pages: withoutSession(read.pages, sessionId) }

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
      page.type === 'found' && page.items.some(({ id }) => id === sessionId),
  )

  return pages.map((page) =>
    shown && page.type === 'found'
      ? {
          ...page,
          items: page.items.filter(({ id }) => id !== sessionId),
          total: page.total === null ? null : page.total - 1,
        }
      : page,
  )
}
