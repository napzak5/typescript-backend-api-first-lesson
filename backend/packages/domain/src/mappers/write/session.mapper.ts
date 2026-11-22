import type {
  ApiAuthLoginRequest,
  ApiAuthTokenRefreshRequest,
  UserId,
} from '../../models/auth'
import type { SessionListCriteria } from '../../repositories/session.repository'
import type { SessionSearchRequest } from '../../schemas/auth.schema'
import { toPaging } from './page'

/**
 * API request → what the use cases of a session work with. Nothing is
 * converted and no row is made: an email, a password, a code and a token
 * are text, and none of them is kept as it is presented. The use case
 * compares the password and the code with what is stored, and finds a
 * session by the hash of its token.
 */
export const SessionWriteMapper = {
  /**
   * What a login presents: the email and the password of the account,
   * whether the session is to last, and the code of the second factor,
   * null for none.
   */
  fromLoginRequest(request: ApiAuthLoginRequest): {
    email: string
    password: string
    rememberMe: boolean
    twoFactorCode: string | null
  } {
    return {
      email: request.email,
      password: request.password,
      rememberMe: request.rememberMe,
      twoFactorCode: request.twoFactorCode,
    }
  },

  /** The refresh token of the session whose tokens are replaced. */
  fromTokenRefreshRequest(request: ApiAuthTokenRefreshRequest): {
    refreshToken: string
  } {
    return { refreshToken: request.refreshToken }
  },

  /**
   * The criteria of the list of the sessions of a user that have not ended
   * at a moment, and where the page begins.
   */
  fromSearchRequest(
    request: SessionSearchRequest,
    userId: UserId,
    now: string,
  ): SessionListCriteria {
    return { userId, now, ...toPaging(request) }
  },
}
