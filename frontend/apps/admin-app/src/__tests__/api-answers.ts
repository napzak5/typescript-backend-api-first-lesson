import { vi } from 'vitest'

/*
 * Answers of the API for the tests of the functions that call it: those a
 * test cannot bring about with the real API.
 */

export const json = (
  status: number,
  body: unknown,
  type = 'application/json',
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': `${type}; charset=utf-8` },
  })

/** A problem the API answers with, naming the values it refused when it is given them. */
export const problem = (
  status: number,
  errors: { field: string; rule: string }[] | null = null,
): Response =>
  json(
    status,
    {
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
      timestamp: '2026-11-20T00:00:00.000Z',
    },
    'application/problem+json',
  )

/** Lets the API answer every request with what `answer` returns. */
export const answering = (
  answer: (request: Request) => Response | Promise<Response>,
) => {
  const fetched = vi.fn<typeof fetch>(async (input, init) =>
    answer(new Request(input, init)),
  )
  vi.stubGlobal('fetch', fetched)

  return fetched
}

/** What a read does not show, and why, for each answer that says nothing. */
export const UNREAD: [string, () => Response | Promise<Response>, string][] = [
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
