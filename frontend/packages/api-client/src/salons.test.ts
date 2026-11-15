import { QueryClient } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest'
import type {
  ModelsProblemDetails,
  ModelsSalonCreateRequest,
  ModelsSalonResponse,
  ModelsSalonUpdateRequest,
  SalonCrudCreate201,
  SalonCrudList200,
  salonCrudCreateResponse,
  salonCrudDeleteResponse,
} from './index'
import {
  getSalonCrudListQueryOptions,
  salonCrudCreate,
  salonCrudDelete,
  salonCrudGet,
  salonCrudList,
  salonCrudUpdate,
} from './index'

const SALON_ID = '0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f07'

const SALON_INPUT: ModelsSalonCreateRequest = {
  name: 'Salon Tokyo',
  nameKana: 'サロントウキョウ',
  description: null,
  postalCode: '150-0001',
  prefecture: '東京都',
  city: '渋谷区',
  address: '神宮前1-2-3',
  building: null,
  latitude: 35.6702,
  longitude: 139.7027,
  phoneNumber: '03-1234-5678',
  alternativePhone: null,
  email: 'tokyo@example.com',
  websiteUrl: null,
  logoUrl: null,
  imageUrls: [],
  features: ['wifi'],
  amenities: [],
  businessHours: null,
  timezone: 'Asia/Tokyo',
  currency: 'JPY',
  taxRate: 10,
  isActive: true,
  openingHours: [],
}

const SALON: ModelsSalonResponse = {
  ...SALON_INPUT,
  id: SALON_ID,
  rating: null,
  reviewCount: 0,
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-14T00:00:00.000Z',
}

const SALON_PAGE: SalonCrudList200 = {
  data: [SALON],
  meta: {
    total: 1,
    limit: 20,
    hasMore: false,
    cursor: null,
    nextCursor: null,
    prevCursor: null,
  },
  links: {
    self: '/api/v1/salons?limit=20',
    first: null,
    last: null,
    next: null,
    prev: null,
  },
}

const SALON_DOCUMENT: SalonCrudCreate201 = {
  data: SALON,
  meta: {
    correlationId: 'req-1',
    timestamp: '2026-11-14T00:00:00.000Z',
    version: '1.0.0',
  },
  links: { self: `/api/v1/salons/${SALON_ID}` },
}

const SALON_CHANGES: ModelsSalonUpdateRequest = {
  name: 'Salon Shibuya',
  building: null,
}

const VALIDATION_PROBLEM: ModelsProblemDetails = {
  type: 'urn:beauty-salon:problem:validation',
  title: 'Validation failed',
  status: 400,
  detail: 'The request is invalid',
  instance: '/api/v1/salons',
  code: '2001',
  errors: [
    {
      field: 'email',
      rule: 'format',
      message: 'Invalid email address',
      value: null,
      constraint: null,
    },
  ],
  correlationId: 'req-1',
  timestamp: '2026-11-14T00:00:00.000Z',
}

const NOT_FOUND_PROBLEM: ModelsProblemDetails = {
  type: 'urn:beauty-salon:problem:not-found',
  title: 'Resource not found',
  status: 404,
  detail: `Salon ${SALON_ID} was not found`,
  instance: `/api/v1/salons/${SALON_ID}`,
  code: '3001',
  errors: null,
  correlationId: 'req-1',
  timestamp: '2026-11-14T00:00:00.000Z',
}

const CONFLICT_PROBLEM: ModelsProblemDetails = {
  type: 'urn:beauty-salon:problem:already-exists',
  title: 'Resource already exists',
  status: 409,
  detail: 'Salon with email tokyo@example.com already exists',
  instance: '/api/v1/salons',
  code: '3002',
  errors: null,
  correlationId: 'req-1',
  timestamp: '2026-11-14T00:00:00.000Z',
}

const UNFINISHED_BOOKINGS_PROBLEM: ModelsProblemDetails = {
  type: 'urn:beauty-salon:problem:operation-not-allowed',
  title: 'Operation not allowed',
  status: 409,
  detail:
    'The salon cannot be deleted: bookings that are not finished refer to it',
  instance: `/api/v1/salons/${SALON_ID}`,
  code: '3003',
  errors: null,
  correlationId: 'req-1',
  timestamp: '2026-11-14T00:00:00.000Z',
}

const FORBIDDEN_PROBLEM: ModelsProblemDetails = {
  type: 'urn:beauty-salon:problem:forbidden',
  title: 'Forbidden',
  status: 403,
  detail: 'This account is not allowed to do this',
  instance: `/api/v1/salons/${SALON_ID}`,
  code: '1005',
  errors: null,
  correlationId: 'req-1',
  timestamp: '2026-11-14T00:00:00.000Z',
}

const RATE_LIMITED_PROBLEM: ModelsProblemDetails = {
  type: 'urn:beauty-salon:problem:rate-limited',
  title: 'Too many requests',
  status: 429,
  detail: 'Wait for the time in the Retry-After header before retrying',
  instance: '/api/v1/salons',
  code: '4005',
  errors: null,
  correlationId: 'req-1',
  timestamp: '2026-11-14T00:00:00.000Z',
}

const stubFetch = (implementation: typeof fetch) => {
  const fetchMock = vi.fn<typeof fetch>(implementation)
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

const respondWithJson = (status: number, body: unknown): typeof fetch => {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
}

const respondWithProblem = (problem: ModelsProblemDetails): typeof fetch => {
  return async () =>
    new Response(JSON.stringify(problem), {
      status: problem.status,
      headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
    })
}

const respondWithNoContent: typeof fetch = async () =>
  new Response(null, { status: 204 })

const failToConnect: typeof fetch = () =>
  Promise.reject(new TypeError('fetch failed'))

const hangUntilAborted: typeof fetch = async (_input, init) => {
  init?.signal?.throwIfAborted()

  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
  })
}

const sentRequest = (fetchMock: Mock<typeof fetch>) => {
  const [url, init] = fetchMock.mock.lastCall ?? []

  return {
    url,
    method: init?.method,
    headers: init?.headers,
    body: init?.body,
  }
}

describe('generated Salon client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('salonCrudList', () => {
    it('should GET the salons of the API origin with the search as a query string', async () => {
      // Arrange
      const fetchMock = stubFetch(respondWithJson(200, SALON_PAGE))

      // Act
      await salonCrudList({
        limit: 20,
        keyword: 'Tokyo',
        features: ['wifi', 'parking'],
      })

      // Assert
      expect(sentRequest(fetchMock)).toEqual({
        url: 'http://localhost:3000/api/v1/salons?limit=20&keyword=Tokyo&features=wifi&features=parking',
        method: 'GET',
      })
    })

    it('should return the page of salons with status 200', async () => {
      // Arrange
      stubFetch(respondWithJson(200, SALON_PAGE))

      // Act
      const response = await salonCrudList()

      // Assert
      expect(response).toEqual({
        data: SALON_PAGE,
        status: 200,
        headers: expect.any(Headers),
      })
    })

    it('should return the problem details with status 400 for an invalid search', async () => {
      // Arrange
      stubFetch(respondWithProblem(VALIDATION_PROBLEM))

      // Act
      const response = await salonCrudList({ limit: 0 })

      // Assert
      expect(response).toEqual({
        data: VALIDATION_PROBLEM,
        status: 400,
        headers: expect.any(Headers),
      })
    })
  })

  describe('salonCrudCreate', () => {
    it('should POST the salon to the API origin as JSON that is encoded once', async () => {
      // Arrange
      const fetchMock = stubFetch(respondWithJson(201, SALON_DOCUMENT))

      // Act
      await salonCrudCreate(SALON_INPUT)

      // Assert
      expect(sentRequest(fetchMock)).toEqual({
        url: 'http://localhost:3000/api/v1/salons',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SALON_INPUT),
      })
    })

    it('should send the headers of the caller next to the content type', async () => {
      // Arrange
      const fetchMock = stubFetch(respondWithJson(201, SALON_DOCUMENT))

      // Act
      await salonCrudCreate(SALON_INPUT, {
        headers: { 'X-Request-Id': 'req-1' },
      })

      // Assert
      expect(sentRequest(fetchMock).headers).toEqual({
        'Content-Type': 'application/json',
        'X-Request-Id': 'req-1',
      })
    })

    it('should return the created salon with status 201', async () => {
      // Arrange
      stubFetch(respondWithJson(201, SALON_DOCUMENT))

      // Act
      const response = await salonCrudCreate(SALON_INPUT)

      // Assert
      expect(response).toEqual({
        data: SALON_DOCUMENT,
        status: 201,
        headers: expect.any(Headers),
      })
    })

    it.each([
      ['400 for an invalid salon', VALIDATION_PROBLEM],
      ['409 for an email that is already registered', CONFLICT_PROBLEM],
    ])(
      'should return the problem details with status %s',
      async (_case, problem) => {
        // Arrange
        stubFetch(respondWithProblem(problem))

        // Act
        const response = await salonCrudCreate(SALON_INPUT)

        // Assert
        expect(response).toEqual({
          data: problem,
          status: problem.status,
          headers: expect.any(Headers),
        })
      },
    )
  })

  describe('salonCrudGet', () => {
    it('should GET the salon with the given ID from the API origin', async () => {
      // Arrange
      const fetchMock = stubFetch(respondWithJson(200, SALON_DOCUMENT))

      // Act
      await salonCrudGet(SALON_ID)

      // Assert
      expect(sentRequest(fetchMock)).toEqual({
        url: `http://localhost:3000/api/v1/salons/${SALON_ID}`,
        method: 'GET',
      })
    })

    it('should return the salon with status 200', async () => {
      // Arrange
      stubFetch(respondWithJson(200, SALON_DOCUMENT))

      // Act
      const response = await salonCrudGet(SALON_ID)

      // Assert
      expect(response).toEqual({
        data: SALON_DOCUMENT,
        status: 200,
        headers: expect.any(Headers),
      })
    })

    it.each([
      ['400 for a malformed ID', VALIDATION_PROBLEM],
      ['404 for an unknown salon', NOT_FOUND_PROBLEM],
    ])(
      'should return the problem details with status %s',
      async (_case, problem) => {
        // Arrange
        stubFetch(respondWithProblem(problem))

        // Act
        const response = await salonCrudGet(SALON_ID)

        // Assert
        expect(response).toEqual({
          data: problem,
          status: problem.status,
          headers: expect.any(Headers),
        })
      },
    )
  })

  describe('salonCrudUpdate', () => {
    it('should PATCH the salon with the changes as JSON that is encoded once', async () => {
      // Arrange
      const fetchMock = stubFetch(respondWithJson(200, SALON_DOCUMENT))

      // Act
      await salonCrudUpdate(SALON_ID, SALON_CHANGES)

      // Assert
      expect(sentRequest(fetchMock)).toEqual({
        url: `http://localhost:3000/api/v1/salons/${SALON_ID}`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"Salon Shibuya","building":null}',
      })
    })

    it('should return the updated salon with status 200', async () => {
      // Arrange
      stubFetch(respondWithJson(200, SALON_DOCUMENT))

      // Act
      const response = await salonCrudUpdate(SALON_ID, SALON_CHANGES)

      // Assert
      expect(response).toEqual({
        data: SALON_DOCUMENT,
        status: 200,
        headers: expect.any(Headers),
      })
    })

    it.each([
      ['400 for invalid changes', VALIDATION_PROBLEM],
      ['404 for an unknown salon', NOT_FOUND_PROBLEM],
      ['409 for an email that is already registered', CONFLICT_PROBLEM],
    ])(
      'should return the problem details with status %s',
      async (_case, problem) => {
        // Arrange
        stubFetch(respondWithProblem(problem))

        // Act
        const response = await salonCrudUpdate(SALON_ID, SALON_CHANGES)

        // Assert
        expect(response).toEqual({
          data: problem,
          status: problem.status,
          headers: expect.any(Headers),
        })
      },
    )
  })

  describe('salonCrudDelete', () => {
    it('should DELETE the salon with the given ID on the API origin', async () => {
      // Arrange
      const fetchMock = stubFetch(respondWithNoContent)

      // Act
      await salonCrudDelete(SALON_ID)

      // Assert
      expect(sentRequest(fetchMock)).toEqual({
        url: `http://localhost:3000/api/v1/salons/${SALON_ID}`,
        method: 'DELETE',
      })
    })

    it('should return no data with status 204', async () => {
      // Arrange
      stubFetch(respondWithNoContent)

      // Act
      const response = await salonCrudDelete(SALON_ID)

      // Assert
      expect(response).toEqual({
        data: undefined,
        status: 204,
        headers: expect.any(Headers),
      })
    })

    it.each([
      ['400 for a malformed ID', VALIDATION_PROBLEM],
      ['404 for an unknown salon', NOT_FOUND_PROBLEM],
      [
        '409 for a salon with bookings that are not finished',
        UNFINISHED_BOOKINGS_PROBLEM,
      ],
    ])(
      'should return the problem details with status %s',
      async (_case, problem) => {
        // Arrange
        stubFetch(respondWithProblem(problem))

        // Act
        const response = await salonCrudDelete(SALON_ID)

        // Assert
        expect(response).toEqual({
          data: problem,
          status: problem.status,
          headers: expect.any(Headers),
        })
      },
    )
  })

  describe('status as the discriminant', () => {
    const describeCreated = (response: salonCrudCreateResponse): string =>
      match(response)
        .with({ status: 201 }, ({ data }) => `created ${data.data.name}`)
        .with({ status: 400 }, ({ data }) => `invalid: ${data.title}`)
        .with(
          { status: P.union(401, 403) },
          ({ data }) => `refused: ${data.detail}`,
        )
        .with({ status: 409 }, ({ data }) => `conflict: ${data.detail}`)
        .with(
          { status: P.union(413, 415, 429, 500) },
          ({ data }) => `failed: ${data.title}`,
        )
        .exhaustive()

    const describeDeleted = (response: salonCrudDeleteResponse): string =>
      match(response)
        .with({ status: 204 }, () => 'deleted')
        .with({ status: 400 }, ({ data }) => `invalid: ${data.title}`)
        .with(
          { status: P.union(401, 403) },
          ({ data }) => `refused: ${data.detail}`,
        )
        .with({ status: 404 }, ({ data }) => `missing: ${data.detail}`)
        .with({ status: 409 }, ({ data }) => `conflict: ${data.detail}`)
        .with(
          { status: P.union(429, 500) },
          ({ data }) => `failed: ${data.title}`,
        )
        .exhaustive()

    it('should narrow a 201 response to the created salon', async () => {
      // Arrange
      stubFetch(respondWithJson(201, SALON_DOCUMENT))

      // Act
      const response = await salonCrudCreate(SALON_INPUT)

      // Assert
      expect(describeCreated(response)).toBe('created Salon Tokyo')
    })

    it('should narrow a 409 response to the problem details', async () => {
      // Arrange
      stubFetch(respondWithProblem(CONFLICT_PROBLEM))

      // Act
      const response = await salonCrudCreate(SALON_INPUT)

      // Assert
      expect(describeCreated(response)).toBe(
        'conflict: Salon with email tokyo@example.com already exists',
      )
    })

    it('should narrow a 429 response, which every operation can answer, to the problem details', async () => {
      // Arrange
      stubFetch(respondWithProblem(RATE_LIMITED_PROBLEM))

      // Act
      const created = await salonCrudCreate(SALON_INPUT)
      const deleted = await salonCrudDelete(SALON_ID)

      // Assert
      expect(describeCreated(created)).toBe('failed: Too many requests')
      expect(describeDeleted(deleted)).toBe('failed: Too many requests')
    })

    it('should narrow a 403 response, which a write by a user without the right can answer, to the problem details', async () => {
      // Arrange
      stubFetch(respondWithProblem(FORBIDDEN_PROBLEM))

      // Act
      const response = await salonCrudDelete(SALON_ID)

      // Assert
      expect(describeDeleted(response)).toBe(
        'refused: This account is not allowed to do this',
      )
    })

    it('should narrow a 409 response, which a delete of a salon with bookings that are not finished answers, to the problem details', async () => {
      // Arrange
      stubFetch(respondWithProblem(UNFINISHED_BOOKINGS_PROBLEM))

      // Act
      const response = await salonCrudDelete(SALON_ID)

      // Assert
      expect(describeDeleted(response)).toBe(
        'conflict: The salon cannot be deleted: bookings that are not finished refer to it',
      )
    })

    it('should narrow a 204 response to a success without data', async () => {
      // Arrange
      stubFetch(respondWithNoContent)

      // Act
      const response = await salonCrudDelete(SALON_ID)

      // Assert
      expect(describeDeleted(response)).toBe('deleted')
    })
  })

  describe('transport failure', () => {
    it.each([
      ['salonCrudList', () => salonCrudList()],
      ['salonCrudCreate', () => salonCrudCreate(SALON_INPUT)],
      ['salonCrudGet', () => salonCrudGet(SALON_ID)],
      ['salonCrudUpdate', () => salonCrudUpdate(SALON_ID, SALON_CHANGES)],
      ['salonCrudDelete', () => salonCrudDelete(SALON_ID)],
    ])(
      'should reject %s when the server cannot be reached',
      async (_name, call) => {
        // Arrange
        stubFetch(failToConnect)

        // Act
        const result = call()

        // Assert
        await expect(result).rejects.toThrow('fetch failed')
      },
    )

    it('should reject when the signal of the caller aborts the request', async () => {
      // Arrange
      stubFetch(hangUntilAborted)
      const controller = new AbortController()

      // Act
      const result = salonCrudGet(SALON_ID, { signal: controller.signal })
      controller.abort()

      // Assert
      await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    })
  })

  describe('with TanStack Query', () => {
    it('should hand a problem response to the query as data', async () => {
      // Arrange
      stubFetch(respondWithProblem(VALIDATION_PROBLEM))
      const queryClient = new QueryClient()

      // Act
      const response = await queryClient.fetchQuery(
        getSalonCrudListQueryOptions({ limit: 0 }),
      )

      // Assert
      expect(response).toEqual({
        data: VALIDATION_PROBLEM,
        status: 400,
        headers: expect.any(Headers),
      })
    })

    it('should fail the query when the server cannot be reached', async () => {
      // Arrange
      stubFetch(failToConnect)
      const queryClient = new QueryClient()

      // Act
      const result = queryClient.fetchQuery(getSalonCrudListQueryOptions())

      // Assert
      await expect(result).rejects.toThrow('fetch failed')
    })
  })
})
