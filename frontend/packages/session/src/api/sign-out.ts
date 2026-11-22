import { authCrudLogout } from '@beauty-salon-frontend/api-client'
import { sessionStore } from '@beauty-salon-frontend/io'

/**
 * Signs out: asks the API to end the session, then removes it from this
 * browser.
 *
 * The session is removed here whatever the API answers, and also when it
 * cannot be reached: somebody who signs out of a shared computer must not
 * stay signed in because the network failed. In that case the session lives
 * on at the API until it expires; it can be ended from another device
 * (`DELETE /api/v1/auth/sessions/{sessionId}`).
 */
export const signOut = async (): Promise<void> => {
  await authCrudLogout().catch(() => undefined)
  sessionStore.clear()
}
