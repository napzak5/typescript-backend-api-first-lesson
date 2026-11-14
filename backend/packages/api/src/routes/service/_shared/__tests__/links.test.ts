import { describe, expect, it } from 'vitest'
import { serviceLinks } from '../links'

const SALON_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
const SERVICE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01'

describe('serviceLinks', () => {
  it('links a service to itself and to the services of its salon', () => {
    const collection = `/api/v1/salons/${SALON_ID}/services`

    expect(serviceLinks(collection, SERVICE_ID)).toEqual({
      self: `${collection}/${SERVICE_ID}`,
      list: collection,
    })
  })

  it('keeps the collection path as the request wrote it and appends the ID it is given', () => {
    const collection = `/api/v1/salons/${SALON_ID.toUpperCase()}/services`

    expect(serviceLinks(collection, SERVICE_ID)).toEqual({
      self: `${collection}/${SERVICE_ID}`,
      list: collection,
    })
  })

  it('keeps the salon of the path in both links, whichever salon that is', () => {
    const links = serviceLinks('/api/v1/salons/another-salon/services', 'abc')

    expect(links).toEqual({
      self: '/api/v1/salons/another-salon/services/abc',
      list: '/api/v1/salons/another-salon/services',
    })
  })
})
