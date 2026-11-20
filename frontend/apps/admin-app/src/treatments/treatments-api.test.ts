import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { salon } from '../bookings/components/examples'
import { aTreatment } from './components/examples'
import {
  createTreatment,
  findTreatmentOfBooking,
  readTreatment,
  readTreatmentPage,
  removeTreatment,
  treatmentListParamsOf,
  updateTreatment,
} from './treatments-api'

/*
 * What the API answers to the treatment records is met with the real API
 * (`treatments.integration.test.tsx`). Here are the answers a test cannot
 * bring about there.
 */

const record = aTreatment()

const {
  id: _id,
  photos: _photos,
  createdAt: _c,
  updatedAt: _u,
  ...written
} = record

/** A page of records as the API answers it */
const page = (
  items: ReturnType<typeof aTreatment>[],
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

describe('treatmentListParamsOf', () => {
  it('should ask for the days at the salon from the moment the first begins to the moment before the day after the last', () => {
    expect(
      treatmentListParamsOf(
        salon.id,
        {
          staff: 'staff',
          customer: 'customer',
          from: '2026-11-01',
          to: '2026-11-20',
        },
        'Asia/Tokyo',
      ),
    ).toEqual({
      salonId: salon.id,
      staffId: 'staff',
      customerId: 'customer',
      startDate: '2026-10-31T15:00:00.000Z',
      endDate: '2026-11-20T14:59:59.999Z',
    })
  })

  it('should ask for the salon alone when nothing narrows the list', () => {
    expect(treatmentListParamsOf(salon.id, {}, 'Asia/Tokyo')).toEqual({
      salonId: salon.id,
    })
  })
})

describe('readTreatmentPage', () => {
  it.each<[string, () => Response]>([
    ['403', () => problem(403)],
    ['400', () => problem(400)],
  ])('should read nothing after %s', async (_, answer) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readTreatmentPage(salon.id, {}, 'Asia/Tokyo', undefined)

    // Assert
    expect(read).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readTreatmentPage(salon.id, {}, 'Asia/Tokyo', undefined)

    // Assert
    expect(read).toEqual({ type })
  })

  it('should read nothing when the customers of the page could not be read', async () => {
    // Arrange
    answering((request) =>
      request.method === 'POST' ? problem(500) : page([record], null),
    )

    // Act
    const read = await readTreatmentPage(salon.id, {}, 'Asia/Tokyo', undefined)

    // Assert
    expect(read).toEqual({ type: 'failed' })
  })
})

describe('findTreatmentOfBooking', () => {
  const of = {
    salonId: salon.id,
    customerId: record.customerId,
    bookingId: record.bookingId,
  }

  it('should read the records of the customer at the salon to their end in their largest pages, and find the one of the booking', async () => {
    // Arrange
    const other = aTreatment({
      id: '09a1b2c3-d4e5-4f60-8a7b-9c0d1e2f3a4b',
      bookingId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    })
    const fetched = answering((request) =>
      new URL(request.url).searchParams.has('cursor')
        ? page([record], null)
        : page([other], other.id),
    )

    // Act
    const read = await findTreatmentOfBooking(of)

    // Assert
    expect(read).toEqual({ type: 'found', record })
    expect(
      fetched.mock.calls.map(([asked]) =>
        Object.fromEntries(new URL(new Request(asked).url).searchParams),
      ),
    ).toEqual([
      { salonId: salon.id, customerId: record.customerId, limit: '100' },
      {
        salonId: salon.id,
        customerId: record.customerId,
        cursor: other.id,
        limit: '100',
      },
    ])
  })

  it('should find no record of a booking that has none', async () => {
    // Arrange
    answering(() => page([], null))

    // Act
    const read = await findTreatmentOfBooking(of)

    // Assert
    expect(read).toEqual({ type: 'found', record: null })
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await findTreatmentOfBooking(of)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readTreatment', () => {
  it('should ask for nothing with an ID that is none', async () => {
    // Arrange
    const fetched = answering(() => json(200, { data: record }))

    // Act
    const read = await readTreatment('latest')

    // Assert
    expect(read).toEqual({ type: 'notFound' })
    expect(fetched).not.toHaveBeenCalled()
  })

  it.each<[string, () => Response]>([
    ['403', () => problem(403)],
    ['400', () => problem(400)],
  ])('should read nothing after %s', async (_, answer) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readTreatment(record.id)

    // Assert
    expect(read).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readTreatment(record.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('createTreatment', () => {
  it.each<[string, () => Response, string]>([
    ['403', () => problem(403), 'forbidden'],
    ['413', () => problem(413), 'failed'],
    ['415', () => problem(415), 'failed'],
  ])('should take %s as %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await createTreatment(salon.id, written)

    // Assert
    expect(outcome).toEqual({ type })
  })

  it.each(UNREAD)('should write nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await createTreatment(salon.id, written)

    // Assert
    expect(outcome).toEqual({ type })
  })

  it('should say nothing of a refusal of the booking when the records of the booking could not be read after it', async () => {
    // Arrange
    answering((request) =>
      request.method === 'POST' ? problem(409) : problem(429),
    )

    // Act
    const outcome = await createTreatment(salon.id, written)

    // Assert
    expect(outcome).toEqual({ type: 'tooManyRequests' })
  })
})

describe('updateTreatment', () => {
  it.each<[string, () => Response, string]>([
    ['403', () => problem(403), 'forbidden'],
    ['413', () => problem(413), 'failed'],
    ['415', () => problem(415), 'failed'],
  ])('should take %s as %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await updateTreatment(record.id, { processingTime: 60 })

    // Assert
    expect(outcome).toEqual({ type })
  })

  it.each(UNREAD)('should write nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await updateTreatment(record.id, { processingTime: 60 })

    // Assert
    expect(outcome).toEqual({ type })
  })
})

describe('removeTreatment', () => {
  it.each<[string, () => Response, string]>([
    ['403', () => problem(403), 'forbidden'],
    ['400', () => problem(400), 'failed'],
  ])('should take %s as %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await removeTreatment(record.id)

    // Assert
    expect(outcome).toEqual({ type })
  })

  it.each(UNREAD)('should remove nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await removeTreatment(record.id)

    // Assert
    expect(outcome).toEqual({ type })
  })
})
