import type { ModelsReviewSortType } from '@beauty-salon-frontend/api-client'
import {
  answering,
  OUTSIDE_THE_CONTRACT,
  page,
  pageOfAGateway,
  problem,
  record,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  findSalons,
  readMenu,
  readReviewSummary,
  readReviews,
  readSalon,
  readStaff,
  readStaffRatings,
} from './salons-api'

/*
 * The answers the real API gives are met in `salons.integration.test.tsx`.
 * Here are the ones a test cannot bring about there (too many requests, no
 * answer, a status the contract does not name), that every operation reads
 * its answers alike, what each operation asks for, and how a list is read
 * to its end.
 */

const SALON_ID = '0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90'
const HIROSHI = '6f81a3c4-e075-429b-93bd-5f7193acc0ce'
const MIKA = '7092b4d5-f186-43ac-a4ce-60829bbdd1df'
const TAKESHI = '81a3c5e6-0297-44bd-b5df-7193acce02e0'

/** What was asked for: the path below `/api/v1`, with its query. */
const asked = (fetched: ReturnType<typeof answering>): string[] =>
  fetched.mock.calls.map(([input]) => {
    const [, operation] = String(input).split('/api/v1')

    return decodeURIComponent(operation ?? '')
  })

/** Every operation of the screens of the salons, called as a screen calls it. */
const OPERATIONS: [string, () => Promise<{ type: string }>][] = [
  ['findSalons', () => findSalons({ keyword: 'cut' }, undefined)],
  ['readSalon', () => readSalon(SALON_ID)],
  ['readMenu', () => readMenu(SALON_ID)],
  ['readStaff', () => readStaff(SALON_ID)],
  ['readReviewSummary', () => readReviewSummary(SALON_ID)],
  ['readStaffRatings', () => readStaffRatings([HIROSHI, MIKA])],
  ['readReviews', () => readReviews(SALON_ID, 'recent', undefined)],
]

const ORDERS: ModelsReviewSortType[] = ['recent', 'rating', 'helpful']

/** Those the API answers with 404 when the salon of the path does not exist. */
const BELOW_A_SALON = OPERATIONS.filter(([name]) =>
  ['readSalon', 'readMenu', 'readReviewSummary'].includes(name),
)

describe('the operations of the screens of the salons', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each(OPERATIONS)('%s', (_name, call) => {
    it('should say that there were too many requests when the API limits them', async () => {
      answering(() => problem(429))

      expect(await call()).toEqual({ type: 'tooManyRequests' })
    })

    it.each([
      ['an error of the server', 500],
      ['a request it does not take', 400],
    ])(
      'should have failed when the API answers with %s',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )

    it('should have failed, and not reject, when there is no answer', async () => {
      answering(() => Promise.reject(new TypeError('Failed to fetch')))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it.each(OUTSIDE_THE_CONTRACT)(
      'should have failed, and not reject, when the answer is %s: a status the contract does not name',
      async (_case, status) => {
        answering(() => pageOfAGateway(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )
  })

  describe.each(BELOW_A_SALON)('%s', (_name, call) => {
    it('should say that there is no such salon when the API does not find it', async () => {
      answering(() => problem(404))

      expect(await call()).toEqual({ type: 'notFound' })
    })
  })

  describe('findSalons', () => {
    it('should ask for the salons that take bookings and meet the conditions, a page of twenty', async () => {
      const fetched = answering(() => page([{ id: 'a' }, { id: 'b' }], 'b', 7))

      const found = await findSalons(
        {
          keyword: 'cut',
          prefecture: '東京都',
          city: '渋谷区',
          minRating: 4.5,
        },
        undefined,
      )

      expect(asked(fetched)).toEqual([
        '/salons?keyword=cut&prefecture=東京都&city=渋谷区&minRating=4.5&isActive=true&limit=20',
      ])
      expect(found).toEqual({
        type: 'found',
        items: [{ id: 'a' }, { id: 'b' }],
        total: 7,
        nextCursor: 'b',
      })
    })

    it('should ask for the page after a cursor', async () => {
      const fetched = answering(() => page([]))

      await findSalons({}, 'b')

      expect(asked(fetched)).toEqual([
        '/salons?cursor=b&isActive=true&limit=20',
      ])
    })
  })

  describe('readSalon', () => {
    it('should hand over the salon of the answer', async () => {
      const fetched = answering(() => record(200, { id: SALON_ID }))

      expect(await readSalon(SALON_ID)).toEqual({
        type: 'found',
        salon: { id: SALON_ID },
      })
      expect(asked(fetched)).toEqual([`/salons/${SALON_ID}`])
    })

    it.each(['beauty-studio-tokyo', '', '0b7f5c1e', `${SALON_ID}/services`])(
      'should not ask the API for %j, which is no ID',
      async (id) => {
        const fetched = answering(() => problem(500))

        expect(await readSalon(id)).toEqual({ type: 'notFound' })
        expect(fetched).not.toHaveBeenCalled()
      },
    )
  })

  describe('readMenu', () => {
    it('should ask for the categories and the services that are switched on, in the largest pages', async () => {
      const fetched = answering((request) =>
        new URL(request.url).pathname.endsWith('/service-categories')
          ? page([{ id: 'cut' }])
          : page([{ id: 'ladies-cut' }]),
      )

      const menu = await readMenu(SALON_ID)

      expect(asked(fetched).toSorted()).toEqual([
        `/salons/${SALON_ID}/service-categories?isActive=true&limit=100`,
        `/salons/${SALON_ID}/services?isActive=true&limit=100`,
      ])
      expect(menu).toEqual({
        type: 'found',
        categories: [{ id: 'cut' }],
        services: [{ id: 'ladies-cut' }],
      })
    })

    it('should read both lists to their ends, a page after the other', async () => {
      const fetched = answering((request) => {
        const { pathname, searchParams } = new URL(request.url)
        const cursor = searchParams.get('cursor')
        const list = pathname.endsWith('/services') ? 'service' : 'category'

        return cursor === null
          ? page([{ id: `${list}-1` }, { id: `${list}-2` }], `${list}-2`)
          : cursor === `${list}-2`
            ? page([{ id: `${list}-3` }], `${list}-3`)
            : page([{ id: `${list}-4` }])
      })

      const menu = await readMenu(SALON_ID)

      expect(menu).toEqual({
        type: 'found',
        categories: [1, 2, 3, 4].map((n) => ({ id: `category-${n}` })),
        services: [1, 2, 3, 4].map((n) => ({ id: `service-${n}` })),
      })
      expect(
        asked(fetched).filter((operation) => operation.includes('/services')),
      ).toEqual([
        `/salons/${SALON_ID}/services?isActive=true&limit=100`,
        `/salons/${SALON_ID}/services?cursor=service-2&isActive=true&limit=100`,
        `/salons/${SALON_ID}/services?cursor=service-3&isActive=true&limit=100`,
      ])
    })

    it('should have no menu, and not half of one, when a later page is not read', async () => {
      answering((request) => {
        const { pathname, searchParams } = new URL(request.url)

        return pathname.endsWith('/services') && searchParams.has('cursor')
          ? problem(500)
          : page([{ id: 'one' }], 'one')
      })

      expect(await readMenu(SALON_ID)).toEqual({ type: 'failed' })
    })

    it('should stop after ten pages of a list that does not end', async () => {
      const fetched = answering((request) => {
        const { searchParams } = new URL(request.url)
        const read = Number(searchParams.get('cursor') ?? '0')

        return page([{ id: String(read + 1) }], String(read + 1))
      })

      const menu = await readMenu(SALON_ID)

      expect(menu).toMatchObject({ type: 'found' })
      expect(menu.type === 'found' ? menu.services : []).toHaveLength(10)
      expect(fetched).toHaveBeenCalledTimes(20)
    })
  })

  describe('readStaff', () => {
    it('should ask for the people of the salon, and read them to the end', async () => {
      const fetched = answering((request) =>
        new URL(request.url).searchParams.has('cursor')
          ? page([{ id: 'second' }])
          : page([{ id: 'first' }], 'first'),
      )

      expect(await readStaff(SALON_ID)).toEqual({
        type: 'found',
        staff: [{ id: 'first' }, { id: 'second' }],
      })
      expect(asked(fetched)).toEqual([
        `/staff-profiles?salonId=${SALON_ID}&limit=100`,
        `/staff-profiles?cursor=first&salonId=${SALON_ID}&limit=100`,
      ])
    })
  })

  describe('readReviewSummary', () => {
    it('should hand over the summary of the answer', async () => {
      const summary = {
        averageRating: 4.4,
        totalReviews: 5,
        ratingDistribution: { '4': 3, '5': 2 },
      }
      const fetched = answering(() => record(200, summary))

      expect(await readReviewSummary(SALON_ID)).toEqual({
        type: 'found',
        summary,
      })
      expect(asked(fetched)).toEqual([`/salons/${SALON_ID}/reviews/summary`])
    })
  })

  describe('readStaffRatings', () => {
    const RATED = {
      averageRating: 4.6,
      totalReviews: 23,
      ratingDistribution: { '1': 0, '2': 0, '3': 2, '4': 5, '5': 16 },
    }
    const UNRATED = {
      averageRating: null,
      totalReviews: 0,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    }

    /** The API answers for each member with what `answers` holds under their ID. */
    const rating = (answers: Record<string, () => Response>) =>
      answering((request) => {
        const { pathname } = new URL(request.url)
        const [, staffId = ''] =
          /\/staff\/([^/]+)\/reviews\/summary$/.exec(pathname) ?? []

        return (answers[staffId] ?? (() => problem(404)))()
      })

    const summaryOf = (summary: unknown) => () => record(200, summary)

    it('should ask for the summary of each member once, and hand the summaries over under their IDs', async () => {
      const fetched = rating({
        [HIROSHI]: summaryOf(RATED),
        [MIKA]: summaryOf(UNRATED),
      })

      expect(await readStaffRatings([HIROSHI, MIKA])).toEqual({
        type: 'found',
        summaries: { [HIROSHI]: RATED, [MIKA]: UNRATED },
      })
      expect(asked(fetched).toSorted()).toEqual(
        [
          `/staff/${HIROSHI}/reviews/summary`,
          `/staff/${MIKA}/reviews/summary`,
        ].toSorted(),
      )
    })

    it('should ask for nothing, and have found nothing, when there is nobody', async () => {
      const fetched = rating({})

      expect(await readStaffRatings([])).toEqual({
        type: 'found',
        summaries: {},
      })
      expect(asked(fetched)).toEqual([])
    })

    it('should have no rating for a member the API does not find, and keep those of the others', async () => {
      rating({ [HIROSHI]: summaryOf(RATED), [TAKESHI]: summaryOf(UNRATED) })

      expect(await readStaffRatings([HIROSHI, MIKA, TAKESHI])).toEqual({
        type: 'found',
        summaries: { [HIROSHI]: RATED, [TAKESHI]: UNRATED },
      })
    })

    it.each([
      ['an error of the server', () => problem(500), 'failed'],
      [
        'no answer',
        () => Promise.reject(new TypeError('Failed to fetch')),
        'failed',
      ],
      ['too many requests', () => problem(429), 'tooManyRequests'],
    ])(
      'should hand over no rating at all when one member alone got %s',
      async (_case, respond, type) => {
        answering((request) =>
          new URL(request.url).pathname.includes(MIKA)
            ? respond()
            : record(200, RATED),
        )

        expect(await readStaffRatings([HIROSHI, MIKA, TAKESHI])).toEqual({
          type,
        })
      },
    )

    it('should say that there were too many requests when one member got that and another got no answer', async () => {
      answering((request) =>
        new URL(request.url).pathname.includes(MIKA)
          ? problem(429)
          : problem(500),
      )

      expect(await readStaffRatings([HIROSHI, MIKA])).toEqual({
        type: 'tooManyRequests',
      })
    })
  })

  describe('readReviews', () => {
    it.each(ORDERS)(
      'should ask for the reviews of the salon in the order %s, a page of ten',
      async (sortBy) => {
        const fetched = answering(() => page([{ id: 'a' }], 'a', 7))

        const reviews = await readReviews(SALON_ID, sortBy, undefined)

        expect(asked(fetched)).toEqual([
          `/reviews?salonId=${SALON_ID}&sortBy=${sortBy}&limit=10`,
        ])
        expect(reviews).toEqual({
          type: 'found',
          items: [{ id: 'a' }],
          total: 7,
          nextCursor: 'a',
        })
      },
    )

    it('should ask for the page after a cursor', async () => {
      const fetched = answering(() => page([]))

      await readReviews(SALON_ID, 'helpful', 'a')

      expect(asked(fetched)).toEqual([
        `/reviews?cursor=a&salonId=${SALON_ID}&sortBy=helpful&limit=10`,
      ])
    })
  })
})
