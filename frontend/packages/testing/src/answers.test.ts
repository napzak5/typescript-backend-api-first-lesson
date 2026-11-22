import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  answering,
  asked,
  empty,
  json,
  OUTSIDE_THE_CONTRACT,
  page,
  pageOfAGateway,
  problem,
  problemWithCode,
  record,
  sent,
  UNREAD,
  UNWRITTEN,
} from './answers'

/*
 * The answers of the API a test makes up: what they say, and that the stub
 * of `fetch` hands a test the request and answers with what it returns.
 * That they are answers of the contract is a test of the API client
 * (`made-up-answers.test.ts`).
 */

const API = 'https://api.salon.example/api/v1'

const JSON_TYPE = 'application/json; charset=utf-8'

/** What each answer of a table is: its status, or why the request fails. */
const outcomesOf = (
  table: [string, () => Response | Promise<Response>, string][],
): Promise<[string, number | string, string][]> =>
  Promise.all(
    table.map(
      async ([name, answer, type]): Promise<
        [string, number | string, string]
      > => [
        name,
        await Promise.resolve()
          .then(answer)
          .then(
            ({ status }) => status,
            (reason: unknown) => String(reason),
          ),
        type,
      ],
    ),
  )

const SAYING_NOTHING: [string, number | string, string][] = [
  ['too many requests', 429, 'tooManyRequests'],
  ['an error of the server', 500, 'failed'],
  ['a session that could not be renewed', 401, 'failed'],
  ['a status the contract does not name', 502, 'failed'],
  ['no answer', 'TypeError: Failed to fetch', 'failed'],
]

describe('the answers of the API a test makes up', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('json', () => {
    it('should answer with the status and the body, as JSON', async () => {
      // Act
      const answer = json(201, { id: 'a' })

      // Assert
      expect(answer.status).toBe(201)
      expect(answer.headers.get('Content-Type')).toBe(JSON_TYPE)
      expect(await answer.json()).toEqual({ id: 'a' })
    })

    it('should answer with the media type it is given', () => {
      expect(
        json(409, {}, 'application/problem+json').headers.get('Content-Type'),
      ).toBe('application/problem+json; charset=utf-8')
    })
  })

  describe('problem', () => {
    it('should answer with the problem details of the status, naming no value', async () => {
      // Act
      const answer = problem(429)

      // Assert
      expect(answer.status).toBe(429)
      expect(answer.headers.get('Content-Type')).toBe(
        'application/problem+json; charset=utf-8',
      )
      expect(await answer.json()).toEqual({
        type: 'urn:beauty-salon:problem',
        title: 'Problem',
        status: 429,
        detail: null,
        instance: null,
        code: '2001',
        errors: null,
        correlationId: null,
        timestamp: '2026-11-20T00:00:00.000Z',
      })
    })

    it('should name the values the API refused, each with its property and the rule it broke', async () => {
      // Act
      const answer = problem(422, [
        { field: 'name', rule: 'required' },
        { field: 'email', rule: 'format' },
      ])

      // Assert
      expect(answer.status).toBe(422)
      expect(await answer.json()).toMatchObject({
        status: 422,
        errors: [
          {
            field: 'name',
            rule: 'required',
            message: 'Invalid',
            value: null,
            constraint: null,
          },
          {
            field: 'email',
            rule: 'format',
            message: 'Invalid',
            value: null,
            constraint: null,
          },
        ],
      })
    })

    it('should name no value when the API refused none by name', async () => {
      expect(await problem(422, []).json()).toMatchObject({ errors: [] })
    })
  })

  describe('problemWithCode', () => {
    it('should answer with the problem details of the status and the code, saying nothing more', async () => {
      // Act
      const answer = problemWithCode(409, '3002')

      // Assert
      expect(answer.status).toBe(409)
      expect(answer.headers.get('Content-Type')).toBe(
        'application/problem+json; charset=utf-8',
      )
      expect(await answer.json()).toEqual({
        type: 'urn:beauty-salon:problem',
        title: 'Problem',
        status: 409,
        detail: null,
        instance: null,
        code: '3002',
        errors: null,
        correlationId: null,
        timestamp: '2026-11-20T00:00:00.000Z',
      })
    })

    it('should say the detail it is given', async () => {
      expect(
        await problemWithCode(409, '3003', 'It cannot be deleted').json(),
      ).toMatchObject({
        status: 409,
        code: '3003',
        detail: 'It cannot be deleted',
        errors: null,
      })
    })
  })

  describe('record', () => {
    it.each<[number]>([[200], [201]])(
      'should wrap one record as the API does, with the status %i',
      async (status) => {
        // Act
        const answer = record(status, { id: 'a' })

        // Assert
        expect(answer.status).toBe(status)
        expect(answer.headers.get('Content-Type')).toBe(JSON_TYPE)
        expect(await answer.json()).toEqual({
          data: { id: 'a' },
          meta: null,
          links: null,
        })
      },
    )
  })

  describe('page', () => {
    it('should answer with the items of the last page of a list, as many as the list has', async () => {
      // Act
      const answer = page([{ id: 'a' }, { id: 'b' }])

      // Assert
      expect(answer.status).toBe(200)
      expect(answer.headers.get('Content-Type')).toBe(JSON_TYPE)
      expect(await answer.json()).toEqual({
        data: [{ id: 'a' }, { id: 'b' }],
        meta: {
          total: 2,
          limit: 100,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: { self: '/', first: null, last: null, next: null, prev: null },
      })
    })

    it('should name the cursor of the page after it, and say that there is more', async () => {
      expect(await page([{ id: 'a' }], 'a').json()).toMatchObject({
        data: [{ id: 'a' }],
        meta: { total: 1, hasMore: true, nextCursor: 'a' },
      })
    })

    it.each<[string, number | null]>([
      ['more than the page holds', 23],
      ['none', 0],
      ['a number the API does not count', null],
    ])(
      'should say how many items the list has in all when a test says so: %s',
      async (_, total) => {
        expect(await page([{ id: 'a' }], 'a', total).json()).toMatchObject({
          data: [{ id: 'a' }],
          meta: { total, hasMore: true, nextCursor: 'a' },
        })
      },
    )

    it('should answer with a page of no item', async () => {
      expect(await page([]).json()).toMatchObject({
        data: [],
        meta: { total: 0, hasMore: false, nextCursor: null },
      })
    })
  })

  describe('empty', () => {
    it.each<[number]>([[204], [200], [403]])(
      'should answer with the status %i and no body, of no media type',
      async (status) => {
        // Act
        const answer = empty(status)

        // Assert
        expect(answer.status).toBe(status)
        expect(answer.body).toBeNull()
        expect(answer.headers.get('Content-Type')).toBeNull()
        expect(await answer.text()).toBe('')
      },
    )
  })

  describe('pageOfAGateway', () => {
    it.each<[number]>([[502], [504], [418]])(
      'should answer with the status %i and a page that is no JSON',
      async (status) => {
        // Act
        const answer = pageOfAGateway(status)

        // Assert
        expect(answer.status).toBe(status)
        expect(answer.headers.get('Content-Type')).toBe('text/html')
        expect(await answer.text()).toBe(
          '<html><body>Bad Gateway</body></html>',
        )
      },
    )
  })

  describe('answering', () => {
    it('should hand the test each request, and answer with what the test returns', async () => {
      // Arrange
      const requests: [string, string, string][] = []
      const fetched = answering(async (request) => {
        requests.push([request.method, request.url, await request.text()])

        return record(200, { number: requests.length })
      })

      // Act
      const first = await fetch(`${API}/salons?keyword=cut`)
      const second = await fetch(`${API}/salons`, {
        method: 'POST',
        body: JSON.stringify({ name: 'a' }),
      })

      // Assert
      expect(requests).toEqual([
        ['GET', `${API}/salons?keyword=cut`, ''],
        ['POST', `${API}/salons`, '{"name":"a"}'],
      ])
      expect(await first.json()).toMatchObject({ data: { number: 1 } })
      expect(await second.json()).toMatchObject({ data: { number: 2 } })
      expect(fetched).toHaveBeenCalledTimes(2)
    })

    it('should let a request fail when the test lets it', async () => {
      // Arrange
      answering(() => Promise.reject(new TypeError('Failed to fetch')))

      // Act and assert
      await expect(fetch(`${API}/salons`)).rejects.toThrow('Failed to fetch')
    })

    it('should stand in for fetch until the test takes the stub away', () => {
      // Arrange
      const fetched = answering(() => problem(500))
      const stubbed = fetch

      // Act
      vi.unstubAllGlobals()

      // Assert
      expect(stubbed).toBe(fetched)
      expect(fetch).not.toBe(fetched)
    })
  })

  describe('asked', () => {
    it('should say the method of each request and its path below the API, in the order they were sent', async () => {
      // Arrange
      const fetched = answering(() => page([]))

      // Act
      await fetch(`${API}/salons`)
      await fetch(`${API}/reviews/a`, { method: 'DELETE' })
      await fetch(`${API}/salons`, { method: 'POST', body: '{}' })

      // Assert
      expect(asked(fetched)).toEqual([
        'GET /salons',
        'DELETE /reviews/a',
        'POST /salons',
      ])
    })

    it('should say the query as it reads, its values in the order of their names', async () => {
      // Arrange
      const fetched = answering(() => page([]))

      // Act
      await fetch(
        `${API}/salons?limit=20&keyword=%E3%82%AB%E3%83%83%E3%83%88+%E3%82%AB%E3%83%A9%E3%83%BC&Zone=a&cursor=b`,
      )

      // Assert
      expect(asked(fetched)).toEqual([
        'GET /salons?Zone=a&cursor=b&keyword=カット カラー&limit=20',
      ])
    })

    it('should leave the values of one name in the order they were sent in', async () => {
      // Arrange
      const fetched = answering(() => page([]))

      // Act
      await fetch(`${API}/customers?tags=b&search=x&tags=a&tags=c`)

      // Assert
      expect(asked(fetched)).toEqual([
        'GET /customers?search=x&tags=b&tags=a&tags=c',
      ])
    })

    it('should keep encoded what would read as the punctuation of the query, in a name and in a value', async () => {
      // Arrange
      const fetched = answering(() => page([]))

      // Act
      await fetch(
        `${API}/purchase-orders?supplier=A%26B+%E5%95%86%E4%BA%8B&note=a%3Db&rate=5%25&a%26b%3Dc=d`,
      )

      // Assert
      expect(asked(fetched)).toEqual([
        'GET /purchase-orders?a%26b%3Dc=d&note=a%3Db&rate=5%25&supplier=A%26B 商事',
      ])
    })

    it('should say the path as it reads, and keep encoded what would read as its punctuation', async () => {
      // Arrange
      const fetched = answering(() => page([]))

      // Act
      await fetch(`${API}/files/%E5%86%99%E7%9C%9F%201.jpg`)
      await fetch(`${API}/files/a%2Fb%3Fc`)

      // Assert
      expect(asked(fetched)).toEqual([
        'GET /files/写真 1.jpg',
        'GET /files/a%2Fb%3Fc',
      ])
    })

    it.each<[string, string, string]>([
      [
        'a storage',
        'https://storage.salon.example/bucket/file?X-Amz-Signature=abc',
        'PUT https://storage.salon.example/bucket/file?X-Amz-Signature=abc',
      ],
      [
        'a path that only begins like that of the API',
        'https://api.salon.example/api/v10/salons',
        'PUT https://api.salon.example/api/v10/salons',
      ],
      [
        'a path that holds that of the API further down',
        'https://storage.salon.example/copies/api/v1/salons',
        'PUT https://storage.salon.example/copies/api/v1/salons',
      ],
    ])(
      'should name a request that went elsewhere with its whole address: %s',
      async (_, address, line) => {
        // Arrange
        const fetched = answering(() => empty(200))

        // Act
        await fetch(address, { method: 'PUT' })

        // Assert
        expect(asked(fetched)).toEqual([line])
      },
    )

    it('should read a fetch that a test watches as it reads one it stands in for', async () => {
      // Arrange
      const fetched = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () => page([]))

      // Act
      await fetch(`${API}/salons?limit=20`)

      // Assert
      expect(asked(fetched)).toEqual(['GET /salons?limit=20'])
    })

    it('should say nothing when nothing was asked', () => {
      expect(asked(answering(() => page([])))).toEqual([])
    })
  })

  describe('sent', () => {
    const JSON_BODY = { 'Content-Type': 'application/json' }

    it('should give the bodies of the requests that had one, in the order they were sent', async () => {
      // Arrange
      const fetched = answering(() => record(200, {}))

      // Act
      await fetch(`${API}/salons`, {
        method: 'POST',
        headers: JSON_BODY,
        body: JSON.stringify({ name: 'first' }),
      })
      await fetch(`${API}/salons`)
      await fetch(`${API}/salons/a`, { method: 'DELETE' })
      await fetch(`${API}/salons/a`, {
        method: 'PATCH',
        headers: JSON_BODY,
        body: JSON.stringify({ name: 'second' }),
      })

      // Assert
      expect(await sent(fetched)).toEqual([
        { name: 'first' },
        { name: 'second' },
      ])
    })

    it('should give a JSON body as the value it reads as, whatever the order of its properties', async () => {
      // Arrange
      const fetched = answering(() => record(200, {}))

      // Act
      await fetch(`${API}/salons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: '{"b":[1,null],"a":"あ"}',
      })

      // Assert
      expect(await sent(fetched)).toStrictEqual([{ a: 'あ', b: [1, null] }])
    })

    it.each<[string, BodyInit, number[]]>([
      [
        'the bytes of a file',
        new Uint8Array([0, 255, 16]).buffer,
        [0, 255, 16],
      ],
      ['a file', new Blob([new Uint8Array([7, 8])]), [7, 8]],
      ['a text', 'ab', [97, 98]],
    ])(
      'should give a body that is no JSON as its bytes: %s',
      async (_, body, bytes) => {
        // Arrange
        const fetched = answering(() => empty(200))

        // Act
        await fetch('https://storage.salon.example/file', {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body,
        })

        // Assert
        expect(await sent(fetched)).toStrictEqual([bytes])
      },
    )

    it('should tell the bytes of one file from those of another', async () => {
      // Arrange
      const fetched = answering(() => empty(200))

      // Act
      await fetch('https://storage.salon.example/file', {
        method: 'PUT',
        body: new Uint8Array([1, 2, 3]).buffer,
      })

      // Assert
      expect(await sent(fetched)).not.toEqual([[1, 2, 4]])
    })

    it.each<[string, RequestInit]>([
      ['a request without one', { method: 'POST' }],
      ['a body of no byte', { method: 'POST', headers: JSON_BODY, body: '' }],
      ['a read', {}],
    ])('should give no body of %s', async (_, init) => {
      // Arrange
      const fetched = answering(() => empty(204))

      // Act
      await fetch(`${API}/reviews/a/helpful`, init)

      // Assert
      expect(await sent(fetched)).toEqual([])
    })

    it('should read a fetch that a test watches as it reads one it stands in for', async () => {
      // Arrange
      const fetched = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () => record(200, {}))

      // Act
      await fetch(`${API}/salons`, {
        method: 'POST',
        headers: JSON_BODY,
        body: JSON.stringify({ name: 'a' }),
      })

      // Assert
      expect(await sent(fetched)).toEqual([{ name: 'a' }])
    })

    it('should give nothing when nothing was asked', async () => {
      expect(await sent(answering(() => record(200, {})))).toEqual([])
    })
  })

  describe('the tables', () => {
    it('should name, for a read, each answer that says nothing and what a read makes of it', async () => {
      expect(await outcomesOf(UNREAD)).toEqual(SAYING_NOTHING)
    })

    it('should name, for a write, the bodies the API does not take, and then the answers that say nothing', async () => {
      expect(await outcomesOf(UNWRITTEN)).toEqual([
        ['a body that is too large', 413, 'failed'],
        ['a body of another type', 415, 'failed'],
        ...SAYING_NOTHING,
      ])
    })

    it('should name the statuses of what stands in front of the API', () => {
      expect(OUTSIDE_THE_CONTRACT).toEqual([
        ['a gateway that does not reach the API', 502],
        ['an API that is not there', 503],
        ['a gateway that waited too long', 504],
        ['a status of no meaning here', 418],
      ])
    })
  })
})
