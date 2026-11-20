import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { salon } from '../bookings/components/examples'
import { aProduct } from '../treatments/components/examples'
import { readProducts } from './products-api'

/*
 * What the API answers to the products is met with the real API
 * (`treatments.integration.test.tsx`). Here are the answers a test cannot
 * bring about there.
 */

/** A page of the products, as the API answers with it. */
const page = (
  items: ReturnType<typeof aProduct>[],
  nextCursor: string | null,
): Response =>
  json(200, {
    data: items,
    meta: {
      total: items.length,
      limit: 100,
      cursor: null,
      nextCursor,
      prevCursor: null,
      hasMore: nextCursor !== null,
      correlationId: null,
    },
    links: { self: '/', next: null, prev: null },
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readProducts', () => {
  it('should read the products of the salon to their end in their largest pages', async () => {
    // Arrange
    const first = aProduct()
    const second = aProduct({ id: 'd6f8b0c2-4e5a-4b7c-9d1f-3a5b7d9f1c46' })
    const fetched = answering((request) =>
      new URL(request.url).searchParams.has('cursor')
        ? page([second], null)
        : page([first], first.id),
    )

    // Act
    const read = await readProducts(salon.id)

    // Assert
    expect(read).toEqual({ type: 'found', items: [first, second] })
    expect(
      fetched.mock.calls.map(([asked]) =>
        Object.fromEntries(new URL(new Request(asked).url).searchParams),
      ),
    ).toEqual([{ limit: '100' }, { cursor: first.id, limit: '100' }])
  })

  it.each<[string, () => Response]>([
    ['403', () => problem(403)],
    ['400', () => problem(400)],
  ])('should read nothing after %s', async (_, answer) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readProducts(salon.id)

    // Assert
    expect(read).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readProducts(salon.id)

    // Assert
    expect(read).toEqual({ type })
  })
})
