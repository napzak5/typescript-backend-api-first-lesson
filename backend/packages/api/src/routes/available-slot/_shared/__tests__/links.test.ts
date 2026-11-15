import { describe, expect, it } from 'vitest'
import { availableSlotCheckLinks } from '../links'

const SLOTS =
  '/api/v1/salons/0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a01/available-slots'

describe('availableSlotCheckLinks', () => {
  it('links the answer to the check, and to the slots of the salon', () => {
    expect(availableSlotCheckLinks(SLOTS)).toEqual({
      self: `${SLOTS}/check`,
      list: SLOTS,
    })
  })

  it('keeps the path as the request wrote it', () => {
    const inUpperCase = SLOTS.toUpperCase()

    expect(availableSlotCheckLinks(inUpperCase)).toEqual({
      self: `${inUpperCase}/check`,
      list: inUpperCase,
    })
  })
})
