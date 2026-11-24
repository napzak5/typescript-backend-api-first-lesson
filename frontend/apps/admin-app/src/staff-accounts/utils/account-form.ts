import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonRoleType,
  ModelsStaffAccountResponse,
  ModelsStaffInvitationResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminStaffAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type {
  AccountUnlinking,
  InvitationAttempt,
  InvitationRevocation,
  RoleChange,
} from '../api/accounts-api'
import { roleNameOf } from './account-format'

/*
 * The forms of the account of a member: the role an invitation gives, and
 * the role the account has; and what the screen does with what the API
 * answered to them, and to a revocation and an unlinking.
 */

/** The control that chooses the role */
export const ROLE = 'role'

const {
  invite,
  revocation: REVOCATION,
  account: ACCOUNT,
  roleChange: ROLE_CHANGE,
  unlinking: UNLINKING,
} = adminStaffAccountMessages

/** The role chosen in a form, if it is one the account may give. */
export const readRole = (
  values: FormData,
  roles: readonly ModelsSalonRoleType[],
): FormRead<ModelsSalonRoleType, FormErrors<LocalizedText>> => {
  const chosen = textOf(values, ROLE)
  const role = roles.find((offered) => offered === chosen)

  return role === undefined
    ? {
        type: 'invalid',
        errors: { [ROLE]: adminStaffAccountMessages.roles.missing },
      }
    : { type: 'valid', value: role }
}

/** What a form of the role of an account gives: nothing to send when the role stays as it is. */
export type RoleChoice =
  | FormRead<ModelsSalonRoleType, FormErrors<LocalizedText>>
  | { type: 'unchanged' }

/** The role chosen for an account, or that it was left as it is. */
export const readRoleChange = (
  values: FormData,
  roles: readonly ModelsSalonRoleType[],
  account: ModelsStaffAccountResponse,
): RoleChoice => {
  const read = readRole(values, roles)

  return read.type === 'valid' && read.value === account.role
    ? { type: 'unchanged' }
    : read
}

/** What the screen does after an invitation was mailed, or was not. */
export type AfterInvitation =
  /** The invitation is shown, and the notification says it was mailed */
  | {
      type: 'invited'
      invitation: ModelsStaffInvitationResponse
      message: LocalizedText
    }
  /** The account an invitation made meanwhile is shown, and what happened is said above it */
  | {
      type: 'accepted'
      account: ModelsStaffAccountResponse
      message: LocalizedText
    }
  /** The member as they are now is shown, and why there was no invitation is said above */
  | { type: 'inactive'; member: ModelsStaffResponse; message: LocalizedText }
  /** The invitation of a minute ago is read again, and the form says why no other was mailed */
  | { type: 'recent'; says: FormSays<LocalizedText> }
  /** The member was removed meanwhile */
  | { type: 'gone' }
  /** The form says what went wrong, and the invitation may be mailed again */
  | { type: 'again'; says: FormSays<LocalizedText> }

/**
 * What the screen does with what the API answered to an invitation, for a
 * member of the name the ledger has (「Yui Watanabe」), who had an
 * invitation before or not.
 */
export const afterInvitation = (
  attempt: InvitationAttempt,
  displayName: string,
  again: boolean,
): AfterInvitation =>
  match(attempt)
    .returnType<AfterInvitation>()
    .with({ type: 'invited' }, ({ invitation }) => ({
      type: 'invited',
      invitation,
      message: again ? invite.doneAgain(displayName) : invite.done(displayName),
    }))
    .with({ type: 'accepted' }, ({ account }) => ({
      type: 'accepted',
      account,
      message: invite.acceptedMeanwhile(displayName),
    }))
    .with({ type: 'inactive' }, ({ member }) => ({
      type: 'inactive',
      member,
      message: invite.inactiveMeanwhile(displayName),
    }))
    .with({ type: 'recent' }, () => ({
      type: 'recent',
      says: aboutTheAttempt(invite.recent(displayName)),
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      says: aboutTheAttempt(invite.forbidden),
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      says: aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      says: aboutTheAttempt(invite.failed),
    }))
    .exhaustive()

/** What the screen does after an attempt to give an account another role. */
export type AfterRoleChange =
  /** The account is shown with its role, and the notification says it was changed */
  | {
      type: 'changed'
      account: ModelsStaffAccountResponse
      message: LocalizedText
    }
  /** What the member has now is read again, and what happened is said above it */
  | { type: 'gone'; message: LocalizedText }
  /** The form says what went wrong */
  | { type: 'again'; says: FormSays<LocalizedText> }

/** What the screen does with what the API answered to a change of the role of the account of a member. */
export const afterRoleChange = (
  change: RoleChange,
  displayName: string,
): AfterRoleChange =>
  match(change)
    .returnType<AfterRoleChange>()
    .with({ type: 'changed' }, ({ account }) => ({
      type: 'changed',
      account,
      message: ROLE_CHANGE.done(displayName, roleNameOf(account.role)),
    }))
    .with({ type: 'gone' }, () => ({
      type: 'gone',
      message: ACCOUNT.goneMeanwhile(displayName),
    }))
    .with({ type: 'own' }, () => ({
      type: 'again',
      says: aboutTheAttempt(ROLE_CHANGE.own),
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      says: aboutTheAttempt(ROLE_CHANGE.forbidden),
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      says: aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      says: aboutTheAttempt(ROLE_CHANGE.failed),
    }))
    .exhaustive()

/** What the screen does after a dialog asked to revoke an invitation or to unlink an account. */
export type AfterDialog =
  /** What the member has now is shown, and the notification says what was done */
  | { type: 'done'; message: LocalizedText }
  /** What the member has now is read again, and what happened is said above it */
  | { type: 'gone'; message: LocalizedText }
  /** The dialog says what went wrong, and the attempt may be made again */
  | { type: 'again'; message: LocalizedText }

const tooManyRequests = (): AfterDialog => ({
  type: 'again',
  message: TOO_MANY_REQUESTS_MESSAGE,
})

/** What the screen does with what the API answered to the revocation of the invitation of a member. */
export const afterRevocation = (
  revocation: InvitationRevocation,
  displayName: string,
): AfterDialog =>
  match(revocation)
    .returnType<AfterDialog>()
    .with({ type: 'revoked' }, () => ({
      type: 'done',
      message: REVOCATION.done(displayName),
    }))
    .with({ type: 'gone' }, () => ({
      type: 'gone',
      message: ACCOUNT.goneMeanwhile(displayName),
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: REVOCATION.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, tooManyRequests)
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: REVOCATION.failed,
    }))
    .exhaustive()

/** What the screen does with what the API answered to the unlinking of the account of a member. */
export const afterUnlinking = (
  unlinking: AccountUnlinking,
  displayName: string,
): AfterDialog =>
  match(unlinking)
    .returnType<AfterDialog>()
    .with({ type: 'unlinked' }, () => ({
      type: 'done',
      message: UNLINKING.done(displayName),
    }))
    .with({ type: 'gone' }, () => ({
      type: 'gone',
      message: ACCOUNT.goneMeanwhile(displayName),
    }))
    .with({ type: 'own' }, () => ({
      type: 'again',
      message: UNLINKING.own,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: UNLINKING.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, tooManyRequests)
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: UNLINKING.failed,
    }))
    .exhaustive()
