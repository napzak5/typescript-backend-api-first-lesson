import { describe, expect, it } from 'vitest'
import { userLinks } from '../links'

describe('userLinks', () => {
  it('links a user to where an administrator reads it', () => {
    expect(
      userLinks('/api/v1/admin/auth', '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c11'),
    ).toEqual({
      self: '/api/v1/admin/auth/users/0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c11',
    })
  })
})
