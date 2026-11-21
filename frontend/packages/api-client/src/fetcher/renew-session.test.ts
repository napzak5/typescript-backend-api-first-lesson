import { describe, expect, it } from 'vitest'
import { getAuthCrudRefreshTokenUrl } from '../generated/endpoints/authentication/authentication'
import { SESSION_RENEWAL_PATH } from './renew-session'

/**
 * The function that sends every request renews the session by itself: it
 * cannot call the generated client, which calls it. The path it sends the
 * refresh token to is compared here with the one generated from the API
 * contract; what it reads of the answers is checked by the types.
 */
describe('the renewal of a session', () => {
  it('should send the refresh token to the path of the operation that exchanges it', () => {
    // Act
    const generated = getAuthCrudRefreshTokenUrl()

    // Assert
    expect(SESSION_RENEWAL_PATH).toBe(generated)
  })
})
