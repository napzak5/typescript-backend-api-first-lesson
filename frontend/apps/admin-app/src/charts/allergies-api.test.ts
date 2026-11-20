import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { aCustomer } from '../bookings/components/examples'
import {
  addAllergy,
  findAllergy,
  readAllergyPage,
  removeAllergy,
  updateAllergy,
} from './allergies-api'
import { allergies, anAllergy } from './components/examples'

/*
 * What the API answers to the allergies is met with the real API
 * (`allergies.integration.test.tsx`). Here are the answers a test cannot
 * bring about there.
 */

const customer = aCustomer()

const allergy = anAllergy()

const { id: _id, createdAt: _c, updatedAt: _u, ...recorded } = allergy

/** A page of allergies as the API answers it */
const page = (
  items: ReturnType<typeof allergies>,
  nextCursor: string | null,
): Response =>
  json(200, {
    data: items,
    meta: {
      total: 3,
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

describe('readAllergyPage', () => {
  it('should ask for the page after the cursor, twenty at a time', async () => {
    // Arrange
    const fetched = answering(() => page(allergies(), null))

    // Act
    const read = await readAllergyPage(customer.id, allergy.id)

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: allergies(),
      total: 3,
      nextCursor: null,
    })
    const [asked] = fetched.mock.calls[0] ?? []
    const url = new URL(new Request(asked ?? '').url)
    expect(url.pathname).toMatch(
      new RegExp(`/medical-charts/customer/${customer.id}/allergies$`),
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cursor: allergy.id,
      limit: '20',
    })
  })

  it.each<[string, () => Response]>([
    ['403', () => problem(403)],
    ['404', () => problem(404)],
    ['400', () => problem(400)],
  ])('should read nothing after %s', async (_, answer) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readAllergyPage(customer.id, undefined)

    // Assert
    expect(read).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readAllergyPage(customer.id, undefined)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('findAllergy', () => {
  it('should read the list to its end in its largest pages, and find the allergy of the ID however its letters are written', async () => {
    // Arrange
    const listed = allergies()
    const last = listed.at(2)
    const cursor = listed.at(1)?.id ?? null
    const fetched = answering((request) =>
      new URL(request.url).searchParams.has('cursor')
        ? page(listed.slice(2), null)
        : page(listed.slice(0, 2), cursor),
    )

    // Act
    const read = await findAllergy(customer.id, (last?.id ?? '').toUpperCase())

    // Assert
    expect(read).toEqual({ type: 'found', allergy: last })
    expect(
      fetched.mock.calls.map(([asked]) =>
        Object.fromEntries(new URL(new Request(asked).url).searchParams),
      ),
    ).toEqual([{ limit: '100' }, { cursor, limit: '100' }])
  })

  it('should not find an allergy that is not among those of the customer', async () => {
    // Arrange
    answering(() => page(allergies(), null))

    // Act
    const read = await findAllergy(
      customer.id,
      '0f1e2d3c-4b5a-4968-8776-655443322110',
    )

    // Assert
    expect(read).toEqual({ type: 'notFound' })
  })

  it('should ask for nothing with an ID that is none', async () => {
    // Arrange
    const fetched = answering(() => page(allergies(), null))

    // Act
    const read = await findAllergy(customer.id, 'peanuts')

    // Assert
    expect(read).toEqual({ type: 'notFound' })
    expect(fetched).not.toHaveBeenCalled()
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await findAllergy(customer.id, allergy.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('addAllergy', () => {
  it.each<[string, () => Response, string]>([
    ['403', () => problem(403), 'forbidden'],
    ['413', () => problem(413), 'failed'],
    ['415', () => problem(415), 'failed'],
  ])('should take %s as %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await addAllergy(customer.id, recorded)

    // Assert
    expect(outcome).toEqual({ type })
  })

  it.each(UNREAD)('should write nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await addAllergy(customer.id, recorded)

    // Assert
    expect(outcome).toEqual({ type })
  })
})

describe('updateAllergy', () => {
  it.each<[string, () => Response, string]>([
    ['403', () => problem(403), 'forbidden'],
    ['413', () => problem(413), 'failed'],
    ['415', () => problem(415), 'failed'],
  ])('should take %s as %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await updateAllergy(customer.id, allergy.id, {
      severityType: 'mild',
    })

    // Assert
    expect(outcome).toEqual({ type })
  })

  it.each(UNREAD)('should write nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await updateAllergy(customer.id, allergy.id, {
      severityType: 'mild',
    })

    // Assert
    expect(outcome).toEqual({ type })
  })
})

describe('removeAllergy', () => {
  it.each<[string, () => Response, string]>([
    ['403', () => problem(403), 'forbidden'],
    ['400', () => problem(400), 'failed'],
  ])('should take %s as %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await removeAllergy(customer.id, allergy.id)

    // Assert
    expect(outcome).toEqual({ type })
  })

  it.each(UNREAD)('should remove nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await removeAllergy(customer.id, allergy.id)

    // Assert
    expect(outcome).toEqual({ type })
  })
})
