import { describe, expect, it } from 'vitest'
import { salonLinks } from '../links'

describe('salonLinks', () => {
  it('links a salon to itself and to the collection', () => {
    expect(salonLinks('/api/v1/salons', 'abc')).toEqual({
      self: '/api/v1/salons/abc',
      list: '/api/v1/salons',
    })
  })
})
