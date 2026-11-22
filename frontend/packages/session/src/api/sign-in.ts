import {
  authCrudLogin,
  type ModelsAuthLoginRequest,
} from '@beauty-salon-frontend/api-client'
import { sessionStore } from '@beauty-salon-frontend/io'
import { match, P } from 'ts-pattern'

/** How an attempt to sign in ended. */
export type SignInOutcome =
  | { type: 'signedIn' }
  /**
   * The API refuses the email address and the password. It does not say
   * which of the two is wrong, nor whether the account is locked.
   */
  | { type: 'wrongCredentials' }
  /**
   * The account has two-factor authentication, and the request carried no
   * code, a wrong one or one that was used before.
   */
  | { type: 'twoFactorCodeRequired' }
  /** The API does not take the request as it is: the properties it names */
  | { type: 'invalid'; fields: string[] }
  | { type: 'tooManyAttempts' }
  /**
   * The API signed the user in, but this browser lets the site store
   * nothing, so nobody is signed in here. The session at the API expires
   * unused.
   */
  | { type: 'notStored' }
  /** No answer, or one that says nothing about the credentials */
  | { type: 'failed' }

/**
 * An answer whose status the contract does not name for the sign-in: a
 * gateway in front of the API answers 502, 503 or 504 when the API does
 * not, and the fetch function resolves with every status. It says nothing
 * about the credentials, and it must not make `signIn` reject.
 */
const outsideTheContract = (): SignInOutcome => ({ type: 'failed' })

/**
 * Signs in. When the API accepts the credentials, the session it issued is
 * stored: from then on every request carries its access token, and
 * `useSession` says that somebody is signed in.
 *
 * Never rejects: what a screen has to tell the user is in the outcome.
 */
export const signIn = async (
  request: ModelsAuthLoginRequest,
): Promise<SignInOutcome> => {
  const response = await authCrudLogin(request).catch(() => null)

  return match(response)
    .returnType<SignInOutcome>()
    .with({ status: 200 }, ({ data }) =>
      sessionStore.write({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        userId: data.data.user.id,
      })
        ? { type: 'signedIn' }
        : { type: 'notStored' },
    )
    .with({ status: 401, data: { code: '1002' } }, () => ({
      type: 'wrongCredentials',
    }))
    .with({ status: 401, data: { code: '1007' } }, () => ({
      type: 'twoFactorCodeRequired',
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      fields: (data.errors ?? []).map((error) => error.field),
    }))
    .with({ status: 429 }, () => ({ type: 'tooManyAttempts' }))
    .with(
      P.union(
        null,
        { status: 401 },
        { status: 413 },
        { status: 415 },
        { status: 500 },
      ),
      () => ({ type: 'failed' }),
    )
    .exhaustive(outsideTheContract)
}
