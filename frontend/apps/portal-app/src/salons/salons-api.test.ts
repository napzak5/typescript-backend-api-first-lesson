import type { ModelsReviewSortType } from '@beauty-salon-frontend/api-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  findSalons,
  readMenu,
  readReviewSummary,
  readReviews,
  readSalon,
  readStaff,
} from './salons-api'

/*
 * The answers the real API gives are met in `salons.integration.test.tsx`.
 * Here are the ones a test cannot bring about there (too many requests, no
 * answer, a status the contract does not name), that every operation reads
 * its answers alike, what each operation asks for, and how a list is read
 * to its end.
 */

const SALON_ID = '0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90'

const answer = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':
        status === 200
          ? 'application/json; charset=utf-8'
          : 'application/problem+json; charset=utf-8',
    },
  })

const problem = (status: number): Response =>
  answer(status, {
    type: 'urn:beauty-salon:problem',
    title: 'Problem',
    status,
    detail: null,
    instance: null,
    code: '2001',
    errors: null,
    correlationId: null,
    timestamp: '2026-11-19T00:00:00.000Z',
  })

/** A page of a list: its items, and the cursor of the page after it. */
const page = (items: unknown[], nextCursor: string | null = null): Response =>
  answer(200, {
    data: items,
    meta: {
      total: 7,
      limit: 100,
      hasMore: nextCursor !== null,
      cursor: null,
      nextCursor,
      prevCursor: null,
    },
    links: null,
  })

/** Lets the API answer every request with what `respond` makes of its address. */
const answering = (respond: (url: URL) => Response | Promise<Response>) => {
  const fetched = vi.fn<typeof fetch>(async (input) =>
    respond(new URL(String(input))),
  )
  vi.stubGlobal('fetch', fetched)

  return fetched
}

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

    it.each([
      ['a gateway that does not reach the API', 502],
      ['an API that is not there', 503],
      ['a gateway that waited too long', 504],
      ['a status of no meaning here', 418],
    ])(
      'should have failed, and not reject, when the answer is %s: a status the contract does not name',
      async (_case, status) => {
        answering(
          () =>
            new Response('<html><body>Bad Gateway</body></html>', {
              status,
              headers: { 'Content-Type': 'text/html' },
            }),
        )

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
      const fetched = answering(() => page([{ id: 'a' }, { id: 'b' }], 'b'))

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
      const fetched = answering(() =>
        answer(200, { data: { id: SALON_ID }, meta: null, links: null }),
      )

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
      const fetched = answering(({ pathname }) =>
        pathname.endsWith('/service-categories')
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
      const fetched = answering(({ pathname, searchParams }) => {
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
      answering(({ pathname, searchParams }) =>
        pathname.endsWith('/services') && searchParams.has('cursor')
          ? problem(500)
          : page([{ id: 'one' }], 'one'),
      )

      expect(await readMenu(SALON_ID)).toEqual({ type: 'failed' })
    })

    it('should stop after ten pages of a list that does not end', async () => {
      const fetched = answering(({ searchParams }) => {
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
      const fetched = answering(({ searchParams }) =>
        searchParams.has('cursor')
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
      const fetched = answering(() =>
        answer(200, { data: summary, meta: null, links: null }),
      )

      expect(await readReviewSummary(SALON_ID)).toEqual({
        type: 'found',
        summary,
      })
      expect(asked(fetched)).toEqual([`/salons/${SALON_ID}/reviews/summary`])
    })
  })

  describe('readReviews', () => {
    it.each(ORDERS)(
      'should ask for the reviews of the salon in the order %s, a page of ten',
      async (sortBy) => {
        const fetched = answering(() => page([{ id: 'a' }], 'a'))

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
