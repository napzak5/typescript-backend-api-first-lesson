import { describe, expect, it } from 'vitest'
import { serviceCategoryLinks } from '../links'

const SALON_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
const CATEGORY_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0d01'

describe('serviceCategoryLinks', () => {
  it('links a category to itself and to the categories of its salon', () => {
    const collection = `/api/v1/salons/${SALON_ID}/service-categories`

    expect(serviceCategoryLinks(collection, CATEGORY_ID)).toEqual({
      self: `${collection}/${CATEGORY_ID}`,
      list: collection,
    })
  })

  it('keeps the salon of the path in both links, whichever salon that is', () => {
    const links = serviceCategoryLinks(
      '/api/v1/salons/another-salon/service-categories',
      'abc',
    )

    expect(links).toEqual({
      self: '/api/v1/salons/another-salon/service-categories/abc',
      list: '/api/v1/salons/another-salon/service-categories',
    })
  })
})
