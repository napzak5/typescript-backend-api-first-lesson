import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonRoleType,
  ModelsStaffAccountResponse,
  ModelsStaffInvitationResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  type FormRead,
  type FormSays,
  textOf,
} from '@beauty-salon-frontend/ui'
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

const NO_ROLE = 'ロールを選んでください。'

/** The role chosen in a form, if it is one the account may give. */
export const readRole = (
  values: FormData,
  roles: readonly ModelsSalonRoleType[],
): FormRead<ModelsSalonRoleType> => {
  const chosen = textOf(values, ROLE)
  const role = roles.find((offered) => offered === chosen)

  return role === undefined
    ? { type: 'invalid', errors: { [ROLE]: NO_ROLE } }
    : { type: 'valid', value: role }
}

/** What a form of the role of an account gives: nothing to send when the role stays as it is. */
export type RoleChoice = FormRead<ModelsSalonRoleType> | { type: 'unchanged' }

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

const notSent = (what: string): FormSays => ({
  message: `${what}通信の状態を確かめて、もう一度お試しください。`,
  errors: {},
})

/** What the screen does after an invitation was mailed, or was not. */
export type AfterInvitation =
  /** The invitation is shown, and the notification says it was mailed */
  | {
      type: 'invited'
      invitation: ModelsStaffInvitationResponse
      message: string
    }
  /** The account an invitation made meanwhile is shown, and what happened is said above it */
  | { type: 'accepted'; account: ModelsStaffAccountResponse; message: string }
  /** The member as they are now is shown, and why there was no invitation is said above */
  | { type: 'inactive'; member: ModelsStaffResponse; message: string }
  /** The invitation of a minute ago is read again, and the form says why no other was mailed */
  | { type: 'recent'; says: FormSays }
  /** The member was removed meanwhile */
  | { type: 'gone' }
  /** The form says what went wrong, and the invitation may be mailed again */
  | { type: 'again'; says: FormSays }

/**
 * What the screen does with what the API answered to an invitation, for a
 * member who is called so (「Yui Watanabe さん」), and who had an
 * invitation before or not.
 */
export const afterInvitation = (
  attempt: InvitationAttempt,
  called: string,
  again: boolean,
): AfterInvitation =>
  match(attempt)
    .returnType<AfterInvitation>()
    .with({ type: 'invited' }, ({ invitation }) => ({
      type: 'invited',
      invitation,
      message: again
        ? `${called}に、招待メールを送り直しました。前に送ったメールのリンクは、使えなくなりました。`
        : `${called}に、招待メールを送りました。`,
    }))
    .with({ type: 'accepted' }, ({ account }) => ({
      type: 'accepted',
      account,
      message: `その間に、${called}が招待を受け入れて、ログインアカウントができていました。招待メールは、送っていません。`,
    }))
    .with({ type: 'inactive' }, ({ member }) => ({
      type: 'inactive',
      member,
      message: `招待メールを送れませんでした。その間に、${called}のスタッフ情報が無効になっていました。`,
    }))
    .with({ type: 'recent' }, () => ({
      type: 'recent',
      says: {
        message: `${called}には、1 分以内に招待メールを送ったばかりです。続けては送れません。メールが見当たらないときは、迷惑メールのフォルダーも確かめてもらい、少し待ってから送り直してください。`,
        errors: {},
      },
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      says: aboutTheAttempt(
        'このアカウントでは、このロールで招待できません。オーナーのロールを与えられるのは、管理者です。',
      ),
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      says: aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      says: notSent('招待メールを送れませんでした。'),
    }))
    .exhaustive()

/** The words said when what was to be changed was not there any more, and the screen shows what is there now */
const goneMeanwhile = (called: string): string =>
  `その間に、${called}のログインアカウントか招待が、変わっていました（招待が受け入れられたか、取り消されたか、紐づけが解除されていました）。いまの状態を出しています。`

/** What the screen does after an attempt to give an account another role. */
export type AfterRoleChange =
  /** The account is shown with its role, and the notification says it was changed */
  | { type: 'changed'; account: ModelsStaffAccountResponse; message: string }
  /** What the member has now is read again, and what happened is said above it */
  | { type: 'gone'; message: string }
  /** The form says what went wrong */
  | { type: 'again'; says: FormSays }

/** What the screen does with what the API answered to a change of the role of the account of a member. */
export const afterRoleChange = (
  change: RoleChange,
  called: string,
): AfterRoleChange =>
  match(change)
    .returnType<AfterRoleChange>()
    .with({ type: 'changed' }, ({ account }) => ({
      type: 'changed',
      account,
      message: `${called}のロールを、${roleNameOf(account.role)}にしました。次の操作から、新しいロールで扱われます。`,
    }))
    .with({ type: 'gone' }, () => ({
      type: 'gone',
      message: goneMeanwhile(called),
    }))
    .with({ type: 'own' }, () => ({
      type: 'again',
      says: aboutTheAttempt('ご自身のアカウントのロールは、変えられません。'),
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      says: aboutTheAttempt(
        'このアカウントでは、このロールを与えられません。オーナーのロールを与えられるのは、管理者です。',
      ),
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      says: aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      says: notSent('ロールを変えられませんでした。'),
    }))
    .exhaustive()

/** What the screen does after a dialog asked to revoke an invitation or to unlink an account. */
export type AfterDialog =
  /** What the member has now is shown, and the notification says what was done */
  | { type: 'done'; message: string }
  /** What the member has now is read again, and what happened is said above it */
  | { type: 'gone'; message: string }
  /** The dialog says what went wrong, and the attempt may be made again */
  | { type: 'again'; message: string }

const tooManyRequests = (): AfterDialog => ({
  type: 'again',
  message: TOO_MANY_REQUESTS_MESSAGE,
})

/** What the screen does with what the API answered to the revocation of the invitation of a member. */
export const afterRevocation = (
  revocation: InvitationRevocation,
  called: string,
): AfterDialog =>
  match(revocation)
    .returnType<AfterDialog>()
    .with({ type: 'revoked' }, () => ({
      type: 'done',
      message: `${called}への招待を取り消しました。`,
    }))
    .with({ type: 'gone' }, () => ({
      type: 'gone',
      message: goneMeanwhile(called),
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: 'このアカウントでは、招待を取り消せません。',
    }))
    .with({ type: 'tooManyRequests' }, tooManyRequests)
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '招待を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()

/** What the screen does with what the API answered to the unlinking of the account of a member. */
export const afterUnlinking = (
  unlinking: AccountUnlinking,
  called: string,
): AfterDialog =>
  match(unlinking)
    .returnType<AfterDialog>()
    .with({ type: 'unlinked' }, () => ({
      type: 'done',
      message: `${called}のログインアカウントの紐づけを解除しました。`,
    }))
    .with({ type: 'gone' }, () => ({
      type: 'gone',
      message: goneMeanwhile(called),
    }))
    .with({ type: 'own' }, () => ({
      type: 'again',
      message: 'ご自身のアカウントの紐づけは、解除できません。',
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: 'このアカウントでは、紐づけを解除できません。',
    }))
    .with({ type: 'tooManyRequests' }, tooManyRequests)
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '紐づけを解除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
