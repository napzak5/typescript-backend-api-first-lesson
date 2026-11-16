import { describe, expect, it } from 'vitest'
import {
  reviewCreateRequestSchema,
  reviewSearchRequestSchema,
  reviewUpdateRequestSchema,
} from '../schemas/review.schema'
import { parseWith } from '../shared'
import { CUSTOMER_ID } from './auth-fixtures'
import { BOOKING_ID } from './booking-fixtures'
import { brokenRules, SALON_ID } from './fixtures'
import { REVIEW_ID, reviewCreateRequest } from './review-fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** What a refused request is told, by `field`. */
const messagesOf = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): Record<string, string> => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' && result.error.type === 'validation'
    ? Object.fromEntries(
        result.error.issues.map(({ field, message }) => [field, message]),
      )
    : {}
}

/** The request without one of its keys. */
const without = (
  request: Record<string, unknown>,
  key: string,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(request).filter(([name]) => name !== key))

const RATINGS = [
  'overallRating',
  'serviceRating',
  'staffRating',
  'atmosphereRating',
  'cleanlinessRating',
  'valueRating',
]

/** A URL of http or https that is `length` characters long. */
const urlOfLength = (length: number): string => {
  const start = 'https://images.example.com/'
  return `${start}${'a'.repeat(length - start.length)}`
}

describe('reviewCreateRequestSchema', () => {
  it('accepts a review that satisfies every rule and returns it unchanged', () => {
    expect(
      parseWith(reviewCreateRequestSchema, reviewCreateRequest(), 'Invalid'),
    ).toEqual({ type: 'success', data: reviewCreateRequest() })
  })

  it('accepts a review of no staff member, of no images and with only the overall rating', () => {
    const request = reviewCreateRequest({
      staffId: null,
      serviceRating: null,
      staffRating: null,
      atmosphereRating: null,
      cleanlinessRating: null,
      valueRating: null,
      title: null,
      comment: null,
      imageUrls: [],
    })

    expect(rulesBrokenBy(reviewCreateRequestSchema, request)).toEqual([])
  })

  it.each(Object.keys(reviewCreateRequest()))(
    'requires %s, null or not',
    (key) => {
      expect(
        rulesBrokenBy(
          reviewCreateRequestSchema,
          without(reviewCreateRequest(), key),
        ),
      ).toEqual([`${key}:invalid_type`])
    },
  )

  it('refuses a property that is not of a review', () => {
    expect(
      rulesBrokenBy(reviewCreateRequestSchema, {
        ...reviewCreateRequest(),
        isVerified: true,
        helpfulCount: 100,
      }),
    ).toEqual([
      'isVerified:unrecognized_keys',
      'helpfulCount:unrecognized_keys',
    ])
  })

  it.each(['salonId', 'customerId', 'bookingId', 'staffId'])(
    'refuses a %s that is not a UUID',
    (key) => {
      expect(
        rulesBrokenBy(reviewCreateRequestSchema, {
          ...reviewCreateRequest(),
          [key]: 'not-a-uuid',
        }),
      ).toEqual([`${key}:invalid_format`])
    },
  )

  it.each(RATINGS)('takes %s from 1 to 5 stars', (key) => {
    for (const stars of [1, 2, 3, 4, 5]) {
      expect(
        rulesBrokenBy(
          reviewCreateRequestSchema,
          reviewCreateRequest({ [key]: stars }),
        ),
      ).toEqual([])
    }
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ [key]: 0 }),
      ),
    ).toEqual([`${key}:too_small`])
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ [key]: 6 }),
      ),
    ).toEqual([`${key}:too_big`])
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ [key]: 4.5 }),
      ),
    ).toEqual([`${key}:invalid_type`])
  })

  it('requires the overall rating', () => {
    expect(
      rulesBrokenBy(reviewCreateRequestSchema, {
        ...reviewCreateRequest(),
        overallRating: null,
      }),
    ).toEqual(['overallRating:invalid_type'])
  })

  it('refuses a rating of a staff member when the review names none', () => {
    const request = reviewCreateRequest({ staffId: null, staffRating: 4 })

    expect(rulesBrokenBy(reviewCreateRequestSchema, request)).toEqual([
      'staffRating:custom',
    ])
    expect(messagesOf(reviewCreateRequestSchema, request)).toEqual({
      staffRating: 'Must be null when staffId is null',
    })
  })

  it('accepts a staff member who is not rated', () => {
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ staffRating: null }),
      ),
    ).toEqual([])
  })

  it('takes a title of up to 255 characters', () => {
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ title: 'あ'.repeat(255) }),
      ),
    ).toEqual([])
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ title: 'あ'.repeat(256) }),
      ),
    ).toEqual(['title:too_big'])
  })

  it.each(['title', 'comment'])('refuses a %s that is blank', (key) => {
    for (const blank of ['', ' ', '　\n']) {
      expect(
        rulesBrokenBy(
          reviewCreateRequestSchema,
          reviewCreateRequest({ [key]: blank }),
        ),
      ).toEqual([`${key}:invalid_format`])
    }
  })

  it('takes a long comment', () => {
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ comment: 'とても良かった。'.repeat(1000) }),
      ),
    ).toEqual([])
  })

  it('takes up to 10 images', () => {
    const urls = Array.from(
      { length: 11 },
      (_, index) => `https://images.example.com/${index}.jpg`,
    )

    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ imageUrls: urls.slice(0, 10) }),
      ),
    ).toEqual([])
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ imageUrls: urls }),
      ),
    ).toEqual(['imageUrls:too_big'])
  })

  it('takes an image URL of http or https of up to 500 characters', () => {
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({
          imageUrls: ['http://images.example.com/a.jpg', urlOfLength(500)],
        }),
      ),
    ).toEqual([])
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ imageUrls: [urlOfLength(501)] }),
      ),
    ).toEqual(['imageUrls.0:too_big'])
  })

  it.each([
    'ftp://images.example.com/a.jpg',
    'javascript:alert(1)',
    'images.example.com/a.jpg',
    '',
  ])('refuses the image URL %j', (url) => {
    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({ imageUrls: [url] }),
      ),
    ).toEqual(['imageUrls.0:invalid_format'])
  })

  it('refuses an image that comes twice, under the second', () => {
    const url = 'https://images.example.com/a.jpg'

    expect(
      rulesBrokenBy(
        reviewCreateRequestSchema,
        reviewCreateRequest({
          imageUrls: [url, 'https://images.example.com/b.jpg', url],
        }),
      ),
    ).toEqual(['imageUrls.2:custom'])
  })

  it('refuses images that are null, which is an empty list', () => {
    expect(
      rulesBrokenBy(reviewCreateRequestSchema, {
        ...reviewCreateRequest(),
        imageUrls: null,
      }),
    ).toEqual(['imageUrls:invalid_type'])
  })

  it('reports every broken rule at once', () => {
    expect(
      rulesBrokenBy(reviewCreateRequestSchema, {
        ...reviewCreateRequest(),
        bookingId: 'not-a-uuid',
        staffId: null,
        overallRating: 0,
        title: ' ',
        imageUrls: ['ftp://images.example.com/a.jpg'],
      }),
    ).toEqual([
      'bookingId:invalid_format',
      'overallRating:too_small',
      'title:invalid_format',
      'imageUrls.0:invalid_format',
      'staffRating:custom',
    ])
  })
})

describe('reviewUpdateRequestSchema', () => {
  /** One value of each property a change may name, each one valid. */
  const CHANGES: [string, unknown][] = [
    ['overallRating', 2],
    ['serviceRating', null],
    ['staffRating', 1],
    ['atmosphereRating', 5],
    ['cleanlinessRating', 3],
    ['valueRating', null],
    ['title', null],
    ['comment', '二度目の来店で、印象が変わりました。'],
    ['imageUrls', []],
  ]

  it.each(CHANGES)(
    'accepts a change of %s alone and returns it unchanged',
    (key, value) => {
      expect(
        parseWith(reviewUpdateRequestSchema, { [key]: value }, 'Invalid'),
      ).toEqual({ type: 'success', data: { [key]: value } })
    },
  )

  it('accepts a change of every property at once', () => {
    const change = Object.fromEntries(CHANGES)

    expect(parseWith(reviewUpdateRequestSchema, change, 'Invalid')).toEqual({
      type: 'success',
      data: change,
    })
  })

  it('refuses a change that names nothing', () => {
    expect(rulesBrokenBy(reviewUpdateRequestSchema, {})).toEqual([':custom'])
    expect(messagesOf(reviewUpdateRequestSchema, {})).toEqual({
      '': 'At least one property must be specified',
    })
  })

  it.each(CHANGES.map(([key]) => key))(
    'refuses %s stated without a value',
    (key) => {
      expect(
        rulesBrokenBy(reviewUpdateRequestSchema, { [key]: undefined }),
      ).toEqual([`${key}:invalid_type`])
    },
  )

  it.each([
    'salonId',
    'customerId',
    'bookingId',
    'staffId',
    'isVerified',
    'helpfulCount',
    'reportCount',
    'ownerResponse',
  ])('refuses %s, which a change does not write', (key) => {
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, {
        title: 'タイトル',
        [key]: null,
      }),
    ).toEqual([`${key}:unrecognized_keys`])
  })

  it.each(RATINGS)('takes %s from 1 to 5 stars', (key) => {
    for (const stars of [1, 2, 3, 4, 5]) {
      expect(
        rulesBrokenBy(reviewUpdateRequestSchema, { [key]: stars }),
      ).toEqual([])
    }
    expect(rulesBrokenBy(reviewUpdateRequestSchema, { [key]: 0 })).toEqual([
      `${key}:too_small`,
    ])
    expect(rulesBrokenBy(reviewUpdateRequestSchema, { [key]: 6 })).toEqual([
      `${key}:too_big`,
    ])
    expect(rulesBrokenBy(reviewUpdateRequestSchema, { [key]: 4.5 })).toEqual([
      `${key}:invalid_type`,
    ])
  })

  it('refuses an overall rating of null, and takes the other ratings as null', () => {
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, { overallRating: null }),
    ).toEqual(['overallRating:invalid_type'])
    for (const key of RATINGS.filter((name) => name !== 'overallRating')) {
      expect(rulesBrokenBy(reviewUpdateRequestSchema, { [key]: null })).toEqual(
        [],
      )
    }
  })

  it('takes a title of up to 255 characters, and refuses a blank title or comment', () => {
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, { title: 'あ'.repeat(255) }),
    ).toEqual([])
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, { title: 'あ'.repeat(256) }),
    ).toEqual(['title:too_big'])
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, { title: ' ', comment: '　' }),
    ).toEqual(['title:invalid_format', 'comment:invalid_format'])
  })

  it('takes a long comment', () => {
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, {
        comment: 'とても良かった。'.repeat(1000),
      }),
    ).toEqual([])
  })

  it('takes up to 10 images of http or https of up to 500 characters, none twice', () => {
    const urls = Array.from(
      { length: 11 },
      (_, index) => `https://images.example.com/${index}.jpg`,
    )

    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, {
        imageUrls: [...urls.slice(0, 9), urlOfLength(500)],
      }),
    ).toEqual([])
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, { imageUrls: urls }),
    ).toEqual(['imageUrls:too_big'])
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, {
        imageUrls: [
          urlOfLength(501),
          'ftp://images.example.com/a.jpg',
          urls[0],
          urls[0],
        ],
      }),
    ).toEqual([
      'imageUrls.0:too_big',
      'imageUrls.1:invalid_format',
      'imageUrls.3:custom',
    ])
  })

  it('refuses images that are null, which is an empty list', () => {
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, { imageUrls: null }),
    ).toEqual(['imageUrls:invalid_type'])
  })

  it('takes a staff rating, which is checked against the review it changes', () => {
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, { staffRating: 3 }),
    ).toEqual([])
  })

  it('reports every broken rule at once', () => {
    expect(
      rulesBrokenBy(reviewUpdateRequestSchema, {
        overallRating: 0,
        title: '',
        imageUrls: ['images.example.com/a.jpg'],
        staffId: null,
      }),
    ).toEqual([
      'overallRating:too_small',
      'title:invalid_format',
      'imageUrls.0:invalid_format',
      'staffId:unrecognized_keys',
    ])
  })
})

describe('reviewSearchRequestSchema', () => {
  it('accepts a search without any parameter', () => {
    expect(parseWith(reviewSearchRequestSchema, {}, 'Invalid')).toEqual({
      type: 'success',
      data: {},
    })
  })

  it('accepts every filter together and returns them unchanged', () => {
    const search = {
      limit: 50,
      cursor: REVIEW_ID,
      salonId: SALON_ID,
      staffId: STAFF_MEMBER_ID,
      customerId: CUSTOMER_ID,
      bookingId: BOOKING_ID,
      isVerified: false,
      minRating: 2,
      maxRating: 4,
      sortBy: 'helpful',
    }

    expect(parseWith(reviewSearchRequestSchema, search, 'Invalid')).toEqual({
      type: 'success',
      data: search,
    })
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    [
      'a cursor that is not a UUID',
      { cursor: 'next' },
      ['cursor:invalid_format'],
    ],
    [
      'a salon that is not a UUID',
      { salonId: 'x' },
      ['salonId:invalid_format'],
    ],
    [
      'a staff member that is not a UUID',
      { staffId: 'x' },
      ['staffId:invalid_format'],
    ],
    [
      'a customer that is not a UUID',
      { customerId: 'x' },
      ['customerId:invalid_format'],
    ],
    [
      'a booking that is not a UUID',
      { bookingId: 'x' },
      ['bookingId:invalid_format'],
    ],
    [
      'a verification that is not a boolean',
      { isVerified: 'yes' },
      ['isVerified:invalid_type'],
    ],
    ['a lowest rating of 0', { minRating: 0 }, ['minRating:too_small']],
    ['a highest rating of 6', { maxRating: 6 }, ['maxRating:too_big']],
    [
      'a rating that is not whole',
      { minRating: 3.5 },
      ['minRating:invalid_type'],
    ],
    [
      'an order it does not know',
      { sortBy: 'oldest' },
      ['sortBy:invalid_value'],
    ],
    [
      'a parameter it does not know',
      { status: 'published' },
      ['status:unrecognized_keys'],
    ],
  ])('refuses %s', (_, search, rules) => {
    expect(rulesBrokenBy(reviewSearchRequestSchema, search)).toEqual(rules)
  })

  it('refuses a lowest rating above the highest one, under the lowest', () => {
    const search = { minRating: 4, maxRating: 3 }

    expect(rulesBrokenBy(reviewSearchRequestSchema, search)).toEqual([
      'minRating:custom',
    ])
    expect(messagesOf(reviewSearchRequestSchema, search)).toEqual({
      minRating: 'Must not be greater than maxRating',
    })
  })

  it('accepts a lowest rating equal to the highest one, or either alone', () => {
    for (const search of [
      { minRating: 3, maxRating: 3 },
      { minRating: 5 },
      { maxRating: 1 },
    ]) {
      expect(rulesBrokenBy(reviewSearchRequestSchema, search)).toEqual([])
    }
  })

  it.each(['recent', 'rating', 'helpful'])('accepts the order %s', (sortBy) => {
    expect(rulesBrokenBy(reviewSearchRequestSchema, { sortBy })).toEqual([])
  })
})
