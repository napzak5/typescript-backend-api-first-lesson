import { vi } from 'vitest'

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

/** What was asked for: the method, and the path below `/api/v1` with its query. */
export const asked = (fetched: ReturnType<typeof answering>): string[] =>
  fetched.mock.calls.map(([input, init]) => {
    const [, operation] = String(input).split('/api/v1')

    return `${init?.method ?? 'GET'} ${decodeURIComponent(operation ?? '')}`
  })

/** What was sent with the first request. */
export const sent = (fetched: ReturnType<typeof answering>): unknown =>
  fetched.mock.calls.at(0)?.at(1)

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
