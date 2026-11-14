import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const API_ORIGIN = 'http://localhost:3000'

type HttpResponse = {
  data: unknown
  status: number
  headers: Headers
}

const loadCustomInstance = async () => {
  vi.resetModules()
  const { customInstance } = await import('./fetcher')

  return customInstance<HttpResponse>
}

const stubFetch = (implementation: typeof fetch) => {
  const fetchMock = vi.fn<typeof fetch>(implementation)
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

const respondWith = (
  status: number,
  body: string | null,
  headers: Record<string, string>,
): typeof fetch => {
  return async () => new Response(body, { status, headers })
}

const respondWithJson = (status: number, body: unknown): typeof fetch =>
  respondWith(status, JSON.stringify(body), {
    'Content-Type': 'application/json; charset=utf-8',
  })

const hangUntilAborted: typeof fetch = async (_input, init) => {
  init?.signal?.throwIfAborted()

  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
  })
}

const PROBLEM_NOT_FOUND = {
  type: 'urn:beauty-salon:problem:not-found',
  title: 'Resource not found',
  status: 404,
  detail: 'Salon s_404 was not found',
}

describe('customInstance', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_BACKEND_BASE_URL', API_ORIGIN)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('request', () => {
    it('should request the generated path on the API origin', async () => {
      // Arrange
      const fetchMock = stubFetch(respondWithJson(200, { data: [] }))
      const customInstance = await loadCustomInstance()

      // Act
      await customInstance('/api/v1/salons?limit=20', { method: 'GET' })

      // Assert
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/salons?limit=20',
        expect.anything(),
      )
    })

    it('should send the method and the headers it was given', async () => {
      // Arrange
      const fetchMock = stubFetch(respondWithJson(200, { data: [] }))
      const customInstance = await loadCustomInstance()

      // Act
      await customInstance('/api/v1/salons/s_1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'r_1' },
      })

      // Assert
      expect(fetchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': 'r_1',
          },
        }),
      )
    })

    it('should send the body as it is, without encoding it a second time', async () => {
      // Arrange
      const fetchMock = stubFetch(respondWithJson(201, { data: {} }))
      const customInstance = await loadCustomInstance()
      const body = JSON.stringify({ name: 'Salon Tokyo' })

      // Act
      await customInstance('/api/v1/salons', { method: 'POST', body })

      // Assert
      expect(fetchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ body: '{"name":"Salon Tokyo"}' }),
      )
    })
  })

  describe('response', () => {
    it('should resolve to the parsed body and the status of a JSON response', async () => {
      // Arrange
      stubFetch(respondWithJson(200, { data: [{ id: 's_1' }] }))
      const customInstance = await loadCustomInstance()

      // Act
      const result = await customInstance('/api/v1/salons', { method: 'GET' })

      // Assert
      expect(result).toMatchObject({
        data: { data: [{ id: 's_1' }] },
        status: 200,
      })
    })

    it('should resolve with the headers of the response', async () => {
      // Arrange
      stubFetch(
        respondWith(200, '{}', {
          'Content-Type': 'application/json',
          'X-Request-Id': 'r_1',
        }),
      )
      const customInstance = await loadCustomInstance()

      // Act
      const result = await customInstance('/api/v1/salons', { method: 'GET' })

      // Assert
      expect(result.headers.get('X-Request-Id')).toBe('r_1')
    })

    it('should parse a problem details body as JSON', async () => {
      // Arrange
      stubFetch(
        respondWith(404, JSON.stringify(PROBLEM_NOT_FOUND), {
          'Content-Type': 'application/problem+json; charset=utf-8',
        }),
      )
      const customInstance = await loadCustomInstance()

      // Act
      const result = await customInstance('/api/v1/salons/s_404', {
        method: 'GET',
      })

      // Assert
      expect(result).toMatchObject({ data: PROBLEM_NOT_FOUND, status: 404 })
    })

    it.each([400, 404, 409, 500, 503])(
      'should resolve instead of rejecting for status %i',
      async (status) => {
        // Arrange
        stubFetch(respondWithJson(status, { title: 'Problem', status }))
        const customInstance = await loadCustomInstance()

        // Act
        const result = await customInstance('/api/v1/salons', { method: 'GET' })

        // Assert
        expect(result).toMatchObject({
          data: { title: 'Problem', status },
          status,
        })
      },
    )

    it('should resolve to undefined data for a response without content', async () => {
      // Arrange
      stubFetch(respondWith(204, null, {}))
      const customInstance = await loadCustomInstance()

      // Act
      const result = await customInstance('/api/v1/salons/s_1', {
        method: 'DELETE',
      })

      // Assert
      expect(result).toMatchObject({ data: undefined, status: 204 })
    })

    it('should resolve to the text of a body that is not JSON', async () => {
      // Arrange
      stubFetch(
        respondWith(502, '<h1>Bad Gateway</h1>', {
          'Content-Type': 'text/html',
        }),
      )
      const customInstance = await loadCustomInstance()

      // Act
      const result = await customInstance('/api/v1/salons', { method: 'GET' })

      // Assert
      expect(result).toMatchObject({
        data: '<h1>Bad Gateway</h1>',
        status: 502,
      })
    })
  })

  describe('failure', () => {
    it('should reject when the network request fails', async () => {
      // Arrange
      stubFetch(() => Promise.reject(new TypeError('fetch failed')))
      const customInstance = await loadCustomInstance()

      // Act
      const result = customInstance('/api/v1/salons', { method: 'GET' })

      // Assert
      await expect(result).rejects.toThrow(new TypeError('fetch failed'))
    })

    it('should reject when a JSON body cannot be parsed', async () => {
      // Arrange
      stubFetch(
        respondWith(200, '{"data":', { 'Content-Type': 'application/json' }),
      )
      const customInstance = await loadCustomInstance()

      // Act
      const result = customInstance('/api/v1/salons', { method: 'GET' })

      // Assert
      await expect(result).rejects.toBeInstanceOf(SyntaxError)
    })

    it('should reject when the caller aborts the request', async () => {
      // Arrange
      stubFetch(hangUntilAborted)
      const customInstance = await loadCustomInstance()
      const controller = new AbortController()

      // Act
      const result = customInstance('/api/v1/salons', {
        method: 'GET',
        signal: controller.signal,
      })
      controller.abort()

      // Assert
      await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('should reject when the request takes longer than 30 seconds', async () => {
      // Arrange
      const timeout = vi
        .spyOn(AbortSignal, 'timeout')
        .mockReturnValue(
          AbortSignal.abort(new DOMException('Timed out', 'TimeoutError')),
        )
      stubFetch(hangUntilAborted)
      const customInstance = await loadCustomInstance()

      // Act
      const result = customInstance('/api/v1/salons', { method: 'GET' })

      // Assert
      await expect(result).rejects.toMatchObject({ name: 'TimeoutError' })
      expect(timeout).toHaveBeenCalledWith(30_000)
    })

    it('should reject without sending a request when the API origin is not set', async () => {
      // Arrange
      vi.stubEnv('VITE_BACKEND_BASE_URL', undefined)
      const fetchMock = stubFetch(respondWithJson(200, { data: [] }))
      const customInstance = await loadCustomInstance()

      // Act
      const result = customInstance('/api/v1/salons', { method: 'GET' })

      // Assert
      await expect(result).rejects.toThrow('VITE_BACKEND_BASE_URL is not set')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
