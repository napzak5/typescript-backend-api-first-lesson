import { describe, expect, it } from 'vitest'
import { clientOf } from '../client'

describe('clientOf', () => {
  it('should tell the address of the client and its user agent', () => {
    // Act
    const client = clientOf({
      ip: '203.0.113.7',
      headers: { 'user-agent': 'Mozilla/5.0' },
    })

    // Assert
    expect(client).toEqual({
      ipAddress: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
    })
  })

  it('should name no user agent for a request without the header', () => {
    // Act
    const client = clientOf({ ip: '203.0.113.7', headers: {} })

    // Assert
    expect(client).toEqual({ ipAddress: '203.0.113.7', userAgent: null })
  })

  it('should name no address of a connection whose address Node does not know', () => {
    // Act
    const client = clientOf({
      ip: undefined,
      headers: { 'user-agent': 'Mozilla/5.0' },
    })

    // Assert
    expect(client).toEqual({ ipAddress: null, userAgent: 'Mozilla/5.0' })
  })
})
