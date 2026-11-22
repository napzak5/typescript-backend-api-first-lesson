import { type MockInstance, vi } from 'vitest'

/*
 * Answers of the API for the tests of the functions that call it: those a
 * test cannot bring about with the real API. This package cannot depend on
 * the API client (pnpm refuses the cycle: the client is built on `io`,
 * whose tests use this package), so the types the contract is generated
 * into are held against these answers there:
 * `frontend/packages/api-client/src/made-up-answers.test.ts`.
 */

/** A value the API refused: the property, and the rule it broke. */
type RefusedValue = { field: string; rule: string }

/** What a test lets the API answer with. */
type Answer = () => Response | Promise<Response>

/** An answer of a status with a body, as JSON of a media type. */
export const json = (
  status: number,
  body: unknown,
  type = 'application/json',
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': `${type}; charset=utf-8` },
  })

/** The details of a problem, as the API answers with them. */
const problemDetails = (
  status: number,
  code: string,
  detail: string | null,
  errors: RefusedValue[] | null,
): Response =>
  json(
    status,
    {
      type: 'urn:beauty-salon:problem',
      title: 'Problem',
      status,
      detail,
      instance: null,
      code,
      errors:
        errors?.map((error) => ({
          ...error,
          message: 'Invalid',
          value: null,
          constraint: null,
        })) ?? null,
      correlationId: null,
      timestamp: '2026-11-20T00:00:00.000Z',
    },
    'application/problem+json',
  )

/** A problem the API answers with, naming the values it refused when it is given them. */
export const problem = (
  status: number,
  errors: RefusedValue[] | null = null,
): Response => problemDetails(status, '2001', null, errors)

/**
 * A problem with the code the API gives its kind, and with a detail when a
 * test is about what the API says: for the code that reads either.
 */
export const problemWithCode = (
  status: number,
  code: string,
  detail: string | null = null,
): Response => problemDetails(status, code, detail, null)

/** One record, as the API wraps it. */
export const record = (status: number, data: unknown): Response =>
  json(status, { data, meta: null, links: null })

/**
 * A page of a list: its items, the cursor of the page after it, and how
 * many items the list has in all (those of the page, unless a test says).
 */
export const page = (
  items: readonly unknown[],
  nextCursor: string | null = null,
  total: number | null = items.length,
): Response =>
  json(200, {
    data: items,
    meta: {
      total,
      limit: 100,
      hasMore: nextCursor !== null,
      cursor: null,
      nextCursor,
      prevCursor: null,
    },
    links: { self: '/', first: null, last: null, next: null, prev: null },
  })

/** An answer of a status with no body: what the API says to a removal, and what a storage says. */
export const empty = (status: number): Response =>
  new Response(null, { status })

/** An answer that is none of the API's: the page of a gateway. */
export const pageOfAGateway = (status: number): Response =>
  new Response('<html><body>Bad Gateway</body></html>', {
    status,
    headers: { 'Content-Type': 'text/html' },
  })

/**
 * Lets the API answer every request with what `answer` returns. An answer
 * that depends on the address reads it with `new URL(request.url)`. The
 * test takes the stub away again (`vi.unstubAllGlobals()`).
 */
export const answering = (
  answer: (request: Request) => Response | Promise<Response>,
) => {
  const fetched = vi.fn<typeof fetch>(async (input, init) =>
    answer(new Request(input, init)),
  )
  vi.stubGlobal('fetch', fetched)

  return fetched
}

/** Where the API is, below its origin: a line of what was asked leaves it out. */
const API_PATH = '/api/v1'

/**
 * A name or a value of a query as it reads. What would read as the
 * punctuation of the query itself (`&`, `=`, `%`) stays encoded, so that a
 * line says one thing.
 */
const written = (text: string): string =>
  text.replace(/[%&=]/g, encodeURIComponent)

/**
 * The query of an address as it reads, its values in the order of their
 * names: the order they were written in is nothing the API is told. Values
 * of one name stay in the order they were sent in.
 */
const queryOf = (url: URL): string =>
  [...url.searchParams]
    .toSorted(([one], [other]) => Number(one > other) - Number(one < other))
    .map(([name, value]) => `${written(name)}=${written(value)}`)
    .join('&')

/** One request as a line: its method, and where it went, with its query. */
const lineOf = ([input, init]: Parameters<typeof fetch>): string => {
  const request = new Request(input, init)
  const url = new URL(request.url)
  const path = decodeURI(url.pathname)
  const query = queryOf(url)

  return [
    `${request.method} `,
    path.startsWith(`${API_PATH}/`)
      ? path.slice(API_PATH.length)
      : `${url.origin}${path}`,
    query === '' ? '' : `?${query}`,
  ].join('')
}

/** The body of one request, when it has one: JSON as the value it reads as, anything else as its bytes. */
const bodyOf = async ([input, init]: Parameters<typeof fetch>): Promise<
  unknown[]
> => {
  const request = new Request(input, init)
  const type = request.headers.get('Content-Type') ?? ''
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length === 0) {
    return []
  }

  return [
    type.includes('json')
      ? JSON.parse(new TextDecoder().decode(bytes))
      : [...bytes],
  ]
}

/**
 * What was asked for, a line for each request in the order they were sent:
 * `METHOD path?query`, the path and the query as they read. The path of a
 * request to the API is the one below `/api/v1`; a request that went
 * elsewhere (a storage, a probe of the system) is named with its whole
 * address. `fetched` is the stub `answering` returns, or a `fetch`
 * that a test watches (`vi.spyOn(globalThis, 'fetch')`).
 */
export const asked = (fetched: MockInstance<typeof fetch>): string[] =>
  fetched.mock.calls.map(lineOf)

/**
 * What was sent: the bodies of the requests that had one, in the order they
 * were sent. A JSON body is the value it reads as, so that the order of its
 * properties says nothing; any other body is its bytes.
 */
export const sent = async (
  fetched: MockInstance<typeof fetch>,
): Promise<unknown[]> =>
  (await Promise.all(fetched.mock.calls.map(bodyOf))).flat()

/** What a read does not show, and why, for each answer that says nothing. */
export const UNREAD: [string, Answer, string][] = [
  ['too many requests', () => problem(429), 'tooManyRequests'],
  ['an error of the server', () => problem(500), 'failed'],
  ['a session that could not be renewed', () => problem(401), 'failed'],
  ['a status the contract does not name', () => problem(502), 'failed'],
  [
    'no answer',
    () => Promise.reject(new TypeError('Failed to fetch')),
    'failed',
  ],
]

/**
 * What a write does not change, and why: the answers that say nothing,
 * and those to a body the API does not take.
 */
export const UNWRITTEN: [string, Answer, string][] = [
  ['a body that is too large', () => problem(413), 'failed'],
  ['a body of another type', () => problem(415), 'failed'],
  ...UNREAD,
]

/** The answers of something that stands in front of the API, or of nothing a contract names. */
export const OUTSIDE_THE_CONTRACT: [string, number][] = [
  ['a gateway that does not reach the API', 502],
  ['an API that is not there', 503],
  ['a gateway that waited too long', 504],
  ['a status of no meaning here', 418],
]
