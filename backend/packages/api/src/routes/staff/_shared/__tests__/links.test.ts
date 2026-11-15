import { describe, expect, it } from 'vitest'
import { staffLinks } from '../links'

const SALON_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
const STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f01'

describe('staffLinks', () => {
  it('links a staff member to itself and to the staff of its salon', () => {
    const collection = `/api/v1/salons/${SALON_ID}/staff`

    expect(staffLinks(collection, STAFF_ID)).toEqual({
      self: `${collection}/${STAFF_ID}`,
      list: collection,
    })
  })

  it('keeps the collection path as the request wrote it and appends the ID it is given', () => {
    const collection = `/api/v1/salons/${SALON_ID.toUpperCase()}/staff`

    expect(staffLinks(collection, STAFF_ID)).toEqual({
      self: `${collection}/${STAFF_ID}`,
      list: collection,
    })
  })

  it('keeps the salon of the path in both links, whichever salon that is', () => {
    const links = staffLinks('/api/v1/salons/another-salon/staff', 'abc')

    expect(links).toEqual({
      self: '/api/v1/salons/another-salon/staff/abc',
      list: '/api/v1/salons/another-salon/staff',
    })
  })
})
