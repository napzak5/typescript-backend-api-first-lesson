import { vi } from 'vitest'

/*
 * The answers of an API that a test makes up: for what a test against the
 * real API cannot bring about (too many requests, an error of the server,
 * no answer, a status the contract does not name), and to see what a
 * function asks the API for.
 */

type RefusedValue = { field: string; rule: string }

const answer = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':
        status < 300
          ? 'application/json; charset=utf-8'
          : 'application/problem+json; charset=utf-8',
    },
  })

/** The problem details of a status, naming the values the API does not take. */
export const problem = (
  status: number,
  errors: RefusedValue[] | null = null,
): Response =>
  answer(status, {
    type: 'urn:beauty-salon:problem',
    title: 'Problem',
    status,
    detail: null,
    instance: null,
    code: '2001',
    errors:
      errors?.map((error) => ({
        ...error,
        message: 'Invalid',
        value: null,
        constraint: null,
      })) ?? null,
    correlationId: null,
    timestamp: '2026-11-19T00:00:00.000Z',
  })

/** One record, as the API wraps it. */
export const record = (status: number, data: unknown): Response =>
  answer(status, { data, meta: null, links: null })

/** A page of a list: its items, and the cursor of the page after it. */
export const page = (
  items: unknown[],
  nextCursor: string | null = null,
): Response =>
  answer(200, {
    data: items,
    meta: {
      total: items.length,
      limit: 100,
      hasMore: nextCursor !== null,
      cursor: null,
      nextCursor,
      prevCursor: null,
    },
    links: null,
  })

/**
 * Lets the API answer every request with what `respond` makes of its
 * address. The test takes the stub away again (`vi.unstubAllGlobals()`).
 */
export const answering = (
  respond: (url: URL) => Response | Promise<Response>,
) => {
  const fetched = vi.fn<typeof fetch>(async (input) =>
    respond(new URL(String(input))),
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

/** The answers of something that stands in front of the API, or of nothing a contract names. */
export const OUTSIDE_THE_CONTRACT: [string, number][] = [
  ['a gateway that does not reach the API', 502],
  ['an API that is not there', 503],
  ['a gateway that waited too long', 504],
  ['a status of no meaning here', 418],
]

/** An answer that is none of the API's: the page of a gateway. */
export const pageOfAGateway = (status: number): Response =>
  new Response('<html><body>Bad Gateway</body></html>', {
    status,
    headers: { 'Content-Type': 'text/html' },
  })
