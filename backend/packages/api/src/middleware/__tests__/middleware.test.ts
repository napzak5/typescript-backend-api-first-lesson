import { createLogger } from '@beauty-salon-backend/infrastructure'
import express, { type Express, type RequestHandler } from 'express'
import request from 'supertest'
import { match, P } from 'ts-pattern'
import { describe, expect, it } from 'vitest'
import { noteSignedInUser } from '../../shared/signed-in-user'
import { errorHandler, notFoundHandler, toHttpError } from '../errors'
import { requestLogging } from '../request-logging'

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

/**
 * An application with the logging and error middleware around the given
 * route, and the lines it logged.
 */
const createAppWith = (
  route: RequestHandler,
): { app: Express; logs: unknown[] } => {
  const logs: unknown[] = []
  const logger = createLogger(
    { level: 'info', format: 'json', environment: 'test' },
    { write: (line) => logs.push(JSON.parse(line)) },
  )

  const app = express()
  app.use(requestLogging(logger))
  app.get('/route', route)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return { app, logs }
}

const succeed: RequestHandler = (req, res) => {
  res.json({ id: req.id })
}

describe('toHttpError', () => {
  it.each([
    [{ type: 'entity.parse.failed', status: 400 }, 'malformedBody'],
    [{ type: 'entity.too.large', status: 413 }, 'bodyTooLarge'],
    [{ type: 'encoding.unsupported', status: 415 }, 'unsupportedMediaType'],
    [{ type: 'charset.unsupported', status: 415 }, 'unsupportedMediaType'],
    [{ type: 'request.aborted', status: 400 }, 'badRequest'],
    [
      Object.assign(new URIError('Failed to decode'), { status: 400 }),
      'badRequest',
    ],
    [{ status: 500 }, 'unexpected'],
    [new TypeError('undefined is not a function'), 'unexpected'],
    ['a string that was thrown', 'unexpected'],
    [undefined, 'unexpected'],
  ])('should read %j as %s', (error, type) => {
    expect(toHttpError(error)).toEqual({ type })
  })
})

describe('request logging', () => {
  it('should give the request a UUID and return it in X-Request-Id', async () => {
    const { app } = createAppWith(succeed)

    const response = await request(app).get('/route')

    expect(response.headers['x-request-id']).toMatch(UUID)
    expect(response.body).toEqual({ id: response.headers['x-request-id'] })
  })

  it("should keep the caller's request ID", async () => {
    const { app } = createAppWith(succeed)

    const response = await request(app)
      .get('/route')
      .set('X-Request-Id', 'gateway-7f3a.42:1')

    expect(response.headers['x-request-id']).toBe('gateway-7f3a.42:1')
    expect(response.body).toEqual({ id: 'gateway-7f3a.42:1' })
  })

  it.each([
    ['with characters that could forge a log line', 'id", "level": "fatal'],
    ['that is longer than 128 characters', 'a'.repeat(129)],
    ['that is empty', ''],
  ])("should replace a caller's request ID %s", async (_reason, received) => {
    const { app } = createAppWith(succeed)

    const response = await request(app)
      .get('/route')
      .set('X-Request-Id', received)

    expect(response.headers['x-request-id']).toMatch(UUID)
  })

  it('should log one line per request with the ID, the route and the status', async () => {
    const { app, logs } = createAppWith(succeed)

    const response = await request(app).get('/route?page=2')

    expect(logs).toEqual([
      expect.objectContaining({
        level: 'info',
        msg: 'request completed',
        req: {
          id: response.headers['x-request-id'],
          method: 'GET',
          url: '/route?page=2',
          remoteAddress: expect.any(String),
        },
        res: { statusCode: 200 },
        responseTime: expect.any(Number),
      }),
    ])
  })

  it('should keep headers out of the log', async () => {
    const { app, logs } = createAppWith(succeed)

    await request(app)
      .get('/route')
      .set('Authorization', 'Bearer secret-token')
      .set('Cookie', 'session=secret-session')

    expect(JSON.stringify(logs)).not.toContain('secret')
  })

  it("should log a client's mistake as a warning", async () => {
    const { app, logs } = createAppWith(succeed)

    await request(app).get('/elsewhere')

    expect(logs).toMatchObject([{ level: 'warn', res: { statusCode: 404 } }])
  })
})

describe('the user on the line of a request', () => {
  const USER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c01'
  const OTHER_USER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c11'

  /** Notes the user named in `?user=` as signed in, then answers with `?status=`. */
  const signedInRoute: RequestHandler = (req, res) => {
    match(req.query['user'])
      .with(P.string, (user) => noteSignedInUser(req, user))
      .otherwise(() => undefined)
    res
      .status(
        match(req.query['status'])
          .with(P.string, (status) => Number(status))
          .otherwise(() => 200),
      )
      .json({})
  }

  it('should name the signed-in user on the line of the request', async () => {
    const { app, logs } = createAppWith(signedInRoute)

    await request(app).get(`/route?user=${USER_ID}`)

    expect(logs).toEqual([
      expect.objectContaining({
        level: 'info',
        msg: 'request completed',
        userId: USER_ID,
      }),
    ])
    expect(logs[0]).not.toHaveProperty('sessionId')
  })

  it.each([403, 404, 409, 400])(
    'should name the signed-in user on the line of a request answered with %i',
    async (status) => {
      const { app, logs } = createAppWith(signedInRoute)

      await request(app).get(`/route?user=${USER_ID}&status=${status}`)

      expect(logs).toEqual([
        expect.objectContaining({
          level: 'warn',
          msg: 'request completed',
          res: { statusCode: status },
          userId: USER_ID,
        }),
      ])
    },
  )

  it('should name no user on the line of a request nobody signed in for', async () => {
    const { app, logs } = createAppWith(signedInRoute)

    await request(app).get('/route')

    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ msg: 'request completed' })
    expect(logs[0]).not.toHaveProperty('userId')
  })

  it('should name no user on the line of a request that reached no route', async () => {
    const { app, logs } = createAppWith(signedInRoute)

    await request(app).get(`/elsewhere?user=${USER_ID}`)

    expect(logs).toHaveLength(1)
    expect(logs[0]).not.toHaveProperty('userId')
  })

  it('should keep the users of different requests apart', async () => {
    const { app, logs } = createAppWith(signedInRoute)

    await Promise.all([
      request(app).get(`/route?user=${USER_ID}`),
      request(app).get(`/route?user=${OTHER_USER_ID}`),
      request(app).get('/route'),
    ])

    const lineOf = (url: string): unknown =>
      logs.find((line) => JSON.stringify(line).includes(`"url":"${url}"`))
    expect(logs).toHaveLength(3)
    expect(lineOf(`/route?user=${USER_ID}`)).toMatchObject({
      userId: USER_ID,
    })
    expect(lineOf(`/route?user=${OTHER_USER_ID}`)).toMatchObject({
      userId: OTHER_USER_ID,
    })
    expect(lineOf('/route')).toMatchObject({ msg: 'request completed' })
    expect(lineOf('/route')).not.toHaveProperty('userId')
  })
})

describe('error handling', () => {
  it('should answer an unknown route with problem details', async () => {
    const { app } = createAppWith(succeed)

    const response = await request(app).get('/elsewhere?page=2')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      type: 'urn:beauty-salon:problem:route-not-found',
      title: 'Route not found',
      status: 404,
      detail: 'GET /elsewhere is not part of the API',
      instance: '/elsewhere?page=2',
      code: '3001',
      errors: null,
      correlationId: response.headers['x-request-id'],
      timestamp: expect.any(String),
    })
  })

  it.each<[string, RequestHandler]>([
    [
      'a handler that throws',
      () => {
        throw new Error('Cannot read salon of undefined')
      },
    ],
    [
      'an asynchronous handler that rejects',
      () => Promise.reject(new Error('Cannot read salon of undefined')),
    ],
  ])(
    'should answer %s with 500 and nothing about the defect',
    async (_kind, route) => {
      const { app } = createAppWith(route)

      const response = await request(app).get('/route')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({
        type: 'urn:beauty-salon:problem:internal',
        title: 'Internal server error',
        status: 500,
        detail: null,
        instance: '/route',
        code: '4001',
        errors: null,
        correlationId: response.headers['x-request-id'],
        timestamp: expect.any(String),
      })
    },
  )

  it('should log the defect with its stack and the ID of the request', async () => {
    const { app, logs } = createAppWith(() => {
      throw new Error('Cannot read salon of undefined')
    })

    const response = await request(app).get('/route')

    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'error',
        msg: 'Unhandled error',
        req: expect.objectContaining({ id: response.headers['x-request-id'] }),
        err: expect.objectContaining({
          type: 'Error',
          message: 'Cannot read salon of undefined',
          stack: expect.stringContaining('middleware.test.ts'),
        }),
      }),
    )
  })

  it('should log the failed request once, without a stand-in error', async () => {
    const { app, logs } = createAppWith(() => {
      throw new Error('Cannot read salon of undefined')
    })

    await request(app).get('/route')

    expect(logs).toHaveLength(2)
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'error',
        msg: 'request errored',
        res: { statusCode: 500 },
        responseTime: expect.any(Number),
      }),
    )
    expect(JSON.stringify(logs)).not.toContain('failed with status code')
  })

  it('should leave a response that has started as it is', async () => {
    const { app, logs } = createAppWith((_req, res) => {
      res.status(200).write('{"data":')
      throw new Error('Failed halfway')
    })

    await request(app)
      .get('/route')
      .then(
        () => undefined,
        () => undefined,
      )

    expect(logs).toContainEqual(
      expect.objectContaining({ level: 'error', msg: 'Unhandled error' }),
    )
  })
})
