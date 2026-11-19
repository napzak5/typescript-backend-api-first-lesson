import {
  authCrudLogin,
  type authCrudLoginResponse,
  type ModelsAuthLoginRequest,
} from '@beauty-salon-frontend/api-client'
import { sessionStore } from '@beauty-salon-frontend/io'

/**
 * Signs in. When the API accepts the credentials, the session it issued is
 * stored: from then on every request carries its access token, and
 * `useSession` says that somebody is signed in.
 *
 * Resolves to the answer of the API, whatever it is, for the screen to match
 * on: a refusal (401 with code `1002`), the request for a two-factor code
 * (401 with code `1007`), a validation problem, too many attempts.
 */
export const signIn = async (
  request: ModelsAuthLoginRequest,
  options?: RequestInit,
): Promise<authCrudLoginResponse> => {
  const response = await authCrudLogin(request, options)
  if (response.status === 200) {
    sessionStore.write({
      accessToken: response.data.data.accessToken,
      refreshToken: response.data.data.refreshToken,
      userId: response.data.data.user.id,
    })
  }

  return response
}
