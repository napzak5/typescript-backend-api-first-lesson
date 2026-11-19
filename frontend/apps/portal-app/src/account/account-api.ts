import {
  authCrudAcceptStaffInvitation,
  authCrudConfirmEmailVerification,
  authCrudForgotPassword,
  authCrudJoinStaffInvitation,
  authCrudRegister,
  authCrudResetPassword,
  authCrudSendEmailVerification,
  authCrudVerifyResetToken,
  authCrudVerifyStaffInvitation,
  type ModelsAuthRegisterRequest,
  type ModelsProblemDetails,
  type ModelsStaffInvitationResponse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'

/** A value the API does not take: the property, and the rule it broke. */
export type RefusedValue = { field: string; rule: string }

/** How a request ended that the API did not carry out. */
export type Refusal =
  | { type: 'invalid'; values: RefusedValue[] }
  | { type: 'tooManyAttempts' }
  /** No answer, or one that says nothing a person could act on */
  | { type: 'failed' }

/**
 * The token of the link works no more. The API does not say why: it may be
 * unknown, used, expired or withdrawn.
 */
type TokenRefused = { type: 'tokenRefused' }

/**
 * A request that the API answers alike whether or not there is an account:
 * `accepted` says that it was taken, not that a mail was sent.
 */
export type RequestOutcome = { type: 'accepted' } | Refusal

/** A request that a mailed token stands for its sender. */
export type TokenOutcome = { type: 'accepted' } | TokenRefused | Refusal

/** What the API says about an invitation before anything is done with it. */
export type InvitationCheck =
  | {
      type: 'open'
      invitation: ModelsStaffInvitationResponse
      /**
       * `accept`: the invited person chooses a password, and the account is
       * created. `join`: the person has an account and signs in with it
       */
      next: 'accept' | 'join'
    }
  /** The address has an account that the invitation cannot be joined with */
  | { type: 'accountExists' }
  | TokenRefused
  | Refusal

export type InvitationAcceptance =
  | { type: 'accepted' }
  | { type: 'accountExists' }
  | TokenRefused
  | Refusal

export type InvitationJoining =
  | { type: 'accepted' }
  /** The session ended before the request arrived */
  | { type: 'signedOut' }
  /** The account that is signed in is not the one the invitation is for */
  | { type: 'notForThisAccount' }
  | TokenRefused
  | Refusal

type Problem<Status extends number> = {
  status: Status
  data: ModelsProblemDetails
}

/** The answers that every operation of an account has, and no answer at all. */
type Refused =
  | Problem<400>
  | Problem<413>
  | Problem<415>
  | Problem<429>
  | Problem<500>
  | null

const REFUSED = P.union(
  null,
  { status: 400 },
  { status: 413 },
  { status: 415 },
  { status: 429 },
  { status: 500 },
)

const ACCEPTED: { type: 'accepted' } = { type: 'accepted' }

const refusalOf = (answer: Refused): Refusal =>
  match(answer)
    .returnType<Refusal>()
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: (data.errors ?? []).map(({ field, rule }) => ({ field, rule })),
    }))
    .with({ status: 429 }, () => ({ type: 'tooManyAttempts' }))
    .with(
      P.union(null, { status: 413 }, { status: 415 }, { status: 500 }),
      () => ({ type: 'failed' }),
    )
    .exhaustive()

/**
 * The same, for a request with a token. A token the API does not take is no
 * value to correct: the person did not type it, the link carried it.
 */
const tokenRefusalOf = (answer: Refused): TokenRefused | Refusal => {
  const refusal = refusalOf(answer)

  return refusal.type === 'invalid' &&
    refusal.values.some(({ field }) => field === 'token')
    ? { type: 'tokenRefused' }
    : refusal
}

/*
 * None of these functions rejects: what a screen has to tell the user is in
 * the outcome.
 */

/** Registers an account. A mail with a link confirms the address. */
export const register = async (
  request: ModelsAuthRegisterRequest,
): Promise<RequestOutcome> =>
  match(await authCrudRegister(request).catch(() => null))
    .returnType<RequestOutcome>()
    .with({ status: 204 }, () => ACCEPTED)
    .with(REFUSED, refusalOf)
    .exhaustive()

/** Asks for the mail that confirms an address once more. */
export const sendVerificationAgain = async (
  email: string,
): Promise<RequestOutcome> =>
  match(await authCrudSendEmailVerification({ email }).catch(() => null))
    .returnType<RequestOutcome>()
    .with({ status: 204 }, () => ACCEPTED)
    .with(REFUSED, refusalOf)
    .exhaustive()

/** Confirms the address that the token was mailed to. */
export const confirmEmail = async (token: string): Promise<TokenOutcome> =>
  match(await authCrudConfirmEmailVerification({ token }).catch(() => null))
    .returnType<TokenOutcome>()
    .with({ status: 204 }, () => ACCEPTED)
    .with(REFUSED, tokenRefusalOf)
    .exhaustive()

/** Asks for the mail with which a password is set anew. */
export const requestPasswordReset = async (
  email: string,
): Promise<RequestOutcome> =>
  match(await authCrudForgotPassword({ email }).catch(() => null))
    .returnType<RequestOutcome>()
    .with({ status: 204 }, () => ACCEPTED)
    .with(REFUSED, refusalOf)
    .exhaustive()

/** Asks whether the token of a password reset still works. It stays usable. */
export const checkPasswordReset = async (
  token: string,
): Promise<TokenOutcome> =>
  match(await authCrudVerifyResetToken({ token }).catch(() => null))
    .returnType<TokenOutcome>()
    .with({ status: 204 }, () => ACCEPTED)
    .with(REFUSED, tokenRefusalOf)
    .exhaustive()

/** Sets the password of the account that the token was mailed to. Nobody is signed in by it. */
export const resetPassword = async (
  token: string,
  newPassword: string,
): Promise<TokenOutcome> =>
  match(await authCrudResetPassword({ token, newPassword }).catch(() => null))
    .returnType<TokenOutcome>()
    .with({ status: 204 }, () => ACCEPTED)
    .with(REFUSED, tokenRefusalOf)
    .exhaustive()

/** Asks what the invitation is and which of the two ways takes it. It stays usable. */
export const checkInvitation = async (
  token: string,
): Promise<InvitationCheck> =>
  match(await authCrudVerifyStaffInvitation({ token }).catch(() => null))
    .returnType<InvitationCheck>()
    .with(
      { status: 200, data: { links: { accept: P.string } } },
      ({ data }) => ({ type: 'open', invitation: data.data, next: 'accept' }),
    )
    .with({ status: 200, data: { links: { join: P.string } } }, ({ data }) => ({
      type: 'open',
      invitation: data.data,
      next: 'join',
    }))
    // An invitation without a way to take it is none a person can use
    .with({ status: 200 }, () => ({ type: 'failed' }))
    .with({ status: 409 }, () => ({ type: 'accountExists' }))
    .with(REFUSED, tokenRefusalOf)
    .exhaustive()

/** Creates the account of the invited person, with the password they chose. Nobody is signed in by it. */
export const acceptInvitation = async (
  token: string,
  password: string,
): Promise<InvitationAcceptance> =>
  match(
    await authCrudAcceptStaffInvitation({ token, password }).catch(() => null),
  )
    .returnType<InvitationAcceptance>()
    .with({ status: 204 }, () => ACCEPTED)
    .with({ status: 409 }, () => ({ type: 'accountExists' }))
    .with(REFUSED, tokenRefusalOf)
    .exhaustive()

/** Ties the account that is signed in to the staff member of the invitation. */
export const joinInvitation = async (
  token: string,
): Promise<InvitationJoining> =>
  match(await authCrudJoinStaffInvitation({ token }).catch(() => null))
    .returnType<InvitationJoining>()
    .with({ status: 204 }, () => ACCEPTED)
    .with({ status: 401 }, () => ({ type: 'signedOut' }))
    .with(P.union({ status: 403 }, { status: 409 }), () => ({
      type: 'notForThisAccount',
    }))
    .with(REFUSED, tokenRefusalOf)
    .exhaustive()
