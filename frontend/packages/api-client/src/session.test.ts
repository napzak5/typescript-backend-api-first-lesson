import {
  ACCESS_TOKEN_EXPIRED,
  SESSION_NOT_FOUND,
  SESSION_RENEWAL_PATH,
} from '@beauty-salon-frontend/io'
import { describe, expect, it } from 'vitest'
import { getAuthCrudRefreshTokenUrl, ModelsErrorCodeType } from '.'

/**
 * The function that sends every request renews the session by itself: it
 * cannot call the generated client, which calls it. What it knows of the API
 * is compared here with what is generated from the API contract.
 */
describe('what the fetch function knows of the API', () => {
  it('should renew the session at the path of the operation that exchanges a refresh token', () => {
    // Act
    const generated = getAuthCrudRefreshTokenUrl()

    // Assert
    expect(SESSION_RENEWAL_PATH).toBe(generated)
  })

  it('should take for an expired access token and for a missing session the codes the contract has', () => {
    // Act
    const codes = Object.values(ModelsErrorCodeType)

    // Assert
    expect(ACCESS_TOKEN_EXPIRED).toBe(ModelsErrorCodeType.NUMBER_1003)
    expect(SESSION_NOT_FOUND).toBe(ModelsErrorCodeType.NUMBER_1004)
    expect(codes).toContain(ACCESS_TOKEN_EXPIRED)
    expect(codes).toContain(SESSION_NOT_FOUND)
  })
})
