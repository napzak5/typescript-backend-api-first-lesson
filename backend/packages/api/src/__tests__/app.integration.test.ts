import { sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Test } from 'supertest'
import { match } from 'ts-pattern'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_AUTH,
  AUTH,
  insertSession,
  insertUser,
  loginBody,
  minutesFromNow,
  PASSWORD,
  type Session,
  sha256,
  signedInUser,
  signInAsAdmin,
  type TestUser,
} from './_shared/auth-helpers'
import {
  ALLOWED_ORIGIN,
  connectUnreachableDatabase,
  createTestApp,
  getTestDb,
  request,
  UUID,
} from './_shared/test-helpers'

const SALONS = '/api/v1/salons'
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
const JSON_UTF8 = 'application/json; charset=utf-8'
const PROBLEM_JSON = 'application/problem+json; charset=utf-8'

const salon = {
  name: 'Hair Studio Aoyama',
  nameKana: null,
  description: null,
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: '南青山1-2-3',
  building: null,
  latitude: null,
  longitude: null,
  phoneNumber: '03-1234-5678',
  alternativePhone: null,
  email: 'aoyama@example.com',
  websiteUrl: null,
  logoUrl: null,
  imageUrls: [],
  features: [],
  amenities: [],
  businessHours: null,
  timezone: 'Asia/Tokyo',
  currency: 'JPY',
  taxRate: 10,
  isActive: true,
  openingHours: [],
}

describe('request identification', () => {
  it('should put the ID of the request in the header and in the response metadata', async () => {
    const app = createTestApp()
    const asAdmin = await signInAsAdmin(app, getTestDb())

    const response = await request(app)
      .post(SALONS)
      .set('Authorization', asAdmin)
      .send(salon)

    expect(response.status).toBe(201)
    expect(response.headers['x-request-id']).toMatch(UUID)
    expect(response.body.meta.correlationId).toBe(
      response.headers['x-request-id'],
    )
  })

  it("should put the caller's request ID in the problem details of an error", async () => {
    const response = await request(createTestApp())
      .get(`${SALONS}/${UNKNOWN_ID}`)
      .set('X-Request-Id', 'gateway-42')

    expect(response.status).toBe(404)
    expect(response.headers['x-request-id']).toBe('gateway-42')
    expect(response.body.correlationId).toBe('gateway-42')
  })

  it('should log the request under the same ID', async () => {
    const logs: unknown[] = []

    const response = await request(createTestApp({ logs })).get(
      `${SALONS}?limit=5`,
    )

    expect(logs).toMatchObject([
      {
        level: 'info',
        msg: 'request completed',
        req: {
          id: response.headers['x-request-id'],
          method: 'GET',
          url: `${SALONS}?limit=5`,
        },
        res: { statusCode: 200 },
      },
    ])
  })
})

describe('requests the API cannot read', () => {
  it.each<[string, 'get' | 'put', string]>([
    ['an unknown path', 'get', '/api/v1/stylists'],
    ['a path outside the API', 'get', '/'],
    ['a method the route does not have', 'put', `${SALONS}/${UNKNOWN_ID}`],
  ])(
    'should answer %s with 404 problem details',
    async (_kind, method, path) => {
      const response = await request(createTestApp())[method](path)

      expect(response.status).toBe(404)
      expect(response.body).toEqual({
        type: 'urn:beauty-salon:problem:route-not-found',
        title: 'Route not found',
        status: 404,
        detail: `${method.toUpperCase()} ${path} is not part of the API`,
        instance: path,
        code: '3001',
        errors: null,
        correlationId: response.headers['x-request-id'],
        timestamp: expect.any(String),
      })
    },
  )

  it('should answer a body that is not valid JSON with 400', async () => {
    const response = await request(createTestApp())
      .post(SALONS)
      .set('Content-Type', 'application/json')
      .send('{"name": "Hair Studio Aoyama"')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      type: 'urn:beauty-salon:problem:malformed-body',
      status: 400,
      detail: 'The request body is not valid JSON',
      code: '2002',
      correlationId: response.headers['x-request-id'],
    })
  })

  it('should answer a body over the size limit with 413', async () => {
    const response = await request(createTestApp())
      .post(SALONS)
      .send({ ...salon, description: 'a'.repeat(100_000) })

    expect(response.status).toBe(413)
    expect(response.body).toMatchObject({
      type: 'urn:beauty-salon:problem:body-too-large',
      status: 413,
      code: '2004',
    })
  })

  it.each([
    ['a form', 'application/x-www-form-urlencoded', 'name=Hair+Studio+Aoyama'],
    ['plain text', 'text/plain', JSON.stringify(salon)],
    [
      'JSON that is not in Unicode',
      'application/json; charset=shift_jis',
      JSON.stringify(salon),
    ],
  ])('should answer %s with 415', async (_kind, contentType, body) => {
    const response = await request(createTestApp())
      .post(SALONS)
      .set('Content-Type', contentType)
      .send(body)

    expect(response.status).toBe(415)
    expect(response.body).toMatchObject({
      type: 'urn:beauty-salon:problem:unsupported-media-type',
      status: 415,
      code: '2002',
    })
  })

  it('should answer a path that cannot be decoded with 400', async () => {
    const response = await request(createTestApp()).get(`${SALONS}/%E0%A4%A`)

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      type: 'urn:beauty-salon:problem:bad-request',
      status: 400,
      code: '2002',
    })
  })

  it('should create nothing from a rejected body', async () => {
    const app = createTestApp()

    await request(app)
      .post(SALONS)
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(salon))

    const list = await request(app).get(SALONS)
    expect(list.body.data).toEqual([])
  })
})

describe('media type of a response', () => {
  it.each<[string, 'get' | 'post', string, string | null, number]>([
    ['an unknown path', 'get', '/api/v1/stylists', null, 404],
    ['a body that is not valid JSON', 'post', SALONS, '{"name": ', 400],
    ['a body that breaks the rules', 'post', SALONS, '{}', 400],
    ['an ID that is not a UUID', 'get', `${SALONS}/42`, null, 400],
    ['an ID that no salon has', 'get', `${SALONS}/${UNKNOWN_ID}`, null, 404],
  ])(
    'should answer %s as application/problem+json',
    async (_kind, method, path, body, status) => {
      const app = createTestApp()
      const asAdmin = await signInAsAdmin(app, getTestDb())
      const call = request(app)[method](path).set('Authorization', asAdmin)

      const response = await (body === null
        ? call
        : call.set('Content-Type', 'application/json').send(body))

      expect(response.status).toBe(status)
      expect(response.headers['content-type']).toBe(PROBLEM_JSON)
      expect(response.body).toMatchObject({ status })
    },
  )

  it('should answer a request it accepts as application/json', async () => {
    const response = await request(createTestApp()).get(SALONS)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toBe(JSON_UTF8)
  })
})

describe('the language of an error', () => {
  const UNKNOWN_PATH = '/api/v1/stylists'
  const ROUTE_NOT_FOUND = {
    en: 'Route not found',
    ja: 'ルートが見つかりません',
  }

  it('should answer a request that asks for no language in English, and say so', async () => {
    // Act
    const response = await request(createTestApp()).get(UNKNOWN_PATH)

    // Assert
    expect(response.status).toBe(404)
    expect(response.headers['content-language']).toBe('en')
    expect(response.body).toMatchObject({
      title: 'Route not found',
      detail: `GET ${UNKNOWN_PATH} is not part of the API`,
    })
  })

  it.each<[string, string, 'en' | 'ja']>([
    ['Japanese', 'ja', 'ja'],
    ['Japanese of Japan before English', 'ja-JP,ja;q=0.9,en;q=0.8', 'ja'],
    ['English', 'en', 'en'],
    ['English before Japanese', 'en-US,en;q=0.9,ja;q=0.8', 'en'],
    ['Japanese with more weight than English', 'en;q=0.5,ja;q=0.6', 'ja'],
    ['a language the API is not written in', 'fr-FR,fr;q=0.9', 'en'],
    ['any language', '*', 'en'],
    ['anything but English', 'en;q=0', 'ja'],
    ['what is no language range', 'ja_JP', 'en'],
  ])(
    'should answer a request that asks for %s (%j) in the language %s',
    async (_case, acceptLanguage, language) => {
      // Act
      const response = await request(createTestApp())
        .get(UNKNOWN_PATH)
        .set('Accept-Language', acceptLanguage)

      // Assert
      expect(response.status).toBe(404)
      expect(response.headers['content-language']).toBe(language)
      expect(response.body.title).toBe(ROUTE_NOT_FOUND[language])
    },
  )

  it.each<[string, (app: Express) => Test, number, string, string | null]>([
    [
      'a path that is no route',
      (app) => request(app).get(UNKNOWN_PATH),
      404,
      'ルートが見つかりません',
      `GET ${UNKNOWN_PATH} は、この API にありません`,
    ],
    [
      'a body that is not valid JSON',
      (app) =>
        request(app)
          .post(SALONS)
          .set('Content-Type', 'application/json')
          .send('{"name": '),
      400,
      'リクエストの本文を読めません',
      'リクエストの本文が、正しい JSON ではありません',
    ],
    [
      'a body that is no JSON',
      (app) =>
        request(app)
          .post(SALONS)
          .set('Content-Type', 'text/plain')
          .send(JSON.stringify(salon)),
      415,
      '受け付けていないメディアタイプです',
      'リクエストの本文は、UTF-8 の application/json にしてください',
    ],
    [
      'a body over the size limit',
      (app) =>
        request(app)
          .post(SALONS)
          .send({ ...salon, description: 'a'.repeat(100_000) }),
      413,
      'リクエストの本文が大きすぎます',
      'リクエストの本文が 100000 バイトを超えています',
    ],
    [
      'a path that cannot be decoded',
      (app) => request(app).get(`${SALONS}/%E0%A4%A`),
      400,
      'リクエストが正しくありません',
      null,
    ],
    [
      'a request without an access token',
      (app) => request(app).post(SALONS).send(salon),
      401,
      '認証が必要です',
      'アクセストークンを、Authorization ヘッダーに Bearer トークンとして送ってください',
    ],
    [
      'an access token that names no session',
      (app) =>
        request(app)
          .post(SALONS)
          .set('Authorization', 'Bearer no-such-token')
          .send(salon),
      401,
      'トークンが無効です',
      'このトークンは使えません。もう一度サインインしてください',
    ],
    [
      'a login of nobody',
      (app) =>
        request(app)
          .post(`${AUTH}/login`)
          .send(loginBody('nobody@example.com')),
      401,
      'サインインできませんでした',
      'メールアドレスかパスワードが正しくありません',
    ],
  ])(
    'should answer %s in Japanese when Japanese is asked for',
    async (_case, send, status, title, detail) => {
      // Act
      const response = await send(createTestApp()).set('Accept-Language', 'ja')

      // Assert
      expect(response.status).toBe(status)
      expect(response.headers['content-type']).toBe(PROBLEM_JSON)
      expect(response.headers['content-language']).toBe('ja')
      expect(response.body).toMatchObject({ status, title, detail })
    },
  )

  it('should tell a signed-in user what they may not do in Japanese', async () => {
    // Arrange
    const app = createTestApp()
    const customer = await signedInUser(app, getTestDb())

    // Act
    const response = await request(app)
      .post(SALONS)
      .set('Authorization', customer.authorization)
      .set('Accept-Language', 'ja')
      .send(salon)

    // Assert
    expect(response.status).toBe(403)
    expect(response.headers['content-language']).toBe('ja')
    expect(response.body).toMatchObject({
      title: '許可されていません',
      detail: 'このアカウントでは、この操作はできません',
    })
  })

  it('should answer the request over the rate limit in Japanese', async () => {
    // Arrange
    const app = createTestApp({
      rateLimit: { windowMs: 60_000, maxRequests: 1 },
    })
    await request(app).get(SALONS)

    // Act
    const response = await request(app).get(SALONS).set('Accept-Language', 'ja')

    // Assert
    expect(response.status).toBe(429)
    expect(response.headers['content-language']).toBe('ja')
    expect(response.body).toMatchObject({
      title: 'リクエストが多すぎます',
      detail:
        'Retry-After ヘッダーの時間だけ待ってから、もう一度送ってください',
    })
  })

  it('should answer a failing database in Japanese, and log it in English', async () => {
    // Arrange
    const connection = connectUnreachableDatabase()
    const logs: unknown[] = []
    const app = createTestApp({ database: connection.database, logs })

    // Act
    const response = await request(app).get(SALONS).set('Accept-Language', 'ja')
    await connection.close()

    // Assert
    expect(response.status).toBe(500)
    expect(response.headers['content-language']).toBe('ja')
    expect(response.body).toMatchObject({
      title: 'サーバーでエラーが起きました',
      detail: null,
    })
    expect(logs).toContainEqual(
      expect.objectContaining({ level: 'error', msg: 'Failed to list salons' }),
    )
  })

  it.each<
    [string, (app: Express, authorization: string) => Test, number, string]
  >([
    [
      'a salon that is not there',
      (app) => request(app).get(`${SALONS}/${UNKNOWN_ID}`),
      404,
      'Resource not found',
    ],
    [
      'a value that breaks a rule of a request whose headline is in English alone',
      (app) => request(app).post(`${AUTH}/login`).send({}),
      400,
      'Validation failed',
    ],
    [
      'an address of mail that another salon has',
      (app, authorization) =>
        request(app)
          .post(SALONS)
          .set('Authorization', authorization)
          .send(salon),
      409,
      'Resource already exists',
    ],
    [
      'a second factor that is not on',
      (app, authorization) =>
        request(app)
          .post(`${AUTH}/2fa/disable`)
          .set('Authorization', authorization)
          .send({ password: PASSWORD, code: '123456' }),
      409,
      'Operation not allowed',
    ],
  ])(
    'should answer %s, which the domain writes of, in English though Japanese is asked for',
    async (_case, send, status, title) => {
      // Arrange
      const app = createTestApp()
      const asAdmin = await signInAsAdmin(app, getTestDb())
      await request(app).post(SALONS).set('Authorization', asAdmin).send(salon)
      const unasked = await send(app, asAdmin)

      // Act
      const response = await send(app, asAdmin).set('Accept-Language', 'ja')

      // Assert
      expect(response.status).toBe(status)
      expect(response.headers['content-language']).toBe('en')
      expect(response.body).toEqual({
        ...unasked.body,
        title,
        correlationId: response.headers['x-request-id'],
        timestamp: expect.any(String),
      })
    },
  )

  it.each<
    [
      string,
      (app: Express, authorization: string, salonId: string) => Test,
      [string, string],
      [string, string, string, string][],
    ]
  >([
    [
      'a salon that breaks rules',
      (app, authorization) =>
        request(app)
          .post(SALONS)
          .set('Authorization', authorization)
          .send({
            ...salon,
            name: ' ',
            timezone: '+09:00',
            currency: 'yen',
            taxRate: 'ten',
            colour: 'red',
          }),
      ['Invalid salon', 'サロンの内容が正しくありません'],
      [
        [
          'name',
          'invalid_format',
          'Must not be blank',
          '空白だけにはできません',
        ],
        [
          'timezone',
          'custom',
          'Must be the name of a time zone, such as Asia/Tokyo',
          'Asia/Tokyo のような、タイムゾーンの名前にしてください',
        ],
        [
          'currency',
          'invalid_format',
          'Must be a three-letter ISO 4217 currency code',
          'ISO 4217 の 3 文字の通貨コードにしてください',
        ],
        [
          'taxRate',
          'invalid_type',
          'Invalid input: expected number, received string',
          '無効な入力: 数値が期待されましたが、stringが入力されました',
        ],
        [
          'colour',
          'unrecognized_keys',
          'Unknown property',
          'このプロパティは指定できません',
        ],
      ],
    ],
    [
      'opening hours that break rules',
      (app, authorization) =>
        request(app)
          .post(SALONS)
          .set('Authorization', authorization)
          .send({
            ...salon,
            openingHours: [
              {
                dayOfWeek: 'tuesday',
                date: '2026-11-16',
                openTime: '19:00',
                closeTime: '10:00',
                isHoliday: false,
                holidayName: null,
                notes: null,
              },
            ],
          }),
      ['Invalid salon', 'サロンの内容が正しくありません'],
      [
        [
          'openingHours.0.dayOfWeek',
          'custom',
          'Must be the day of the week of 2026-11-16',
          '2026-11-16 の曜日にしてください',
        ],
        [
          'openingHours.0.closeTime',
          'custom',
          'Must be later than openTime',
          'openTime より後にしてください',
        ],
      ],
    ],
    [
      'a change of a salon that names no property',
      (app, authorization, salonId) =>
        request(app)
          .patch(`${SALONS}/${salonId}`)
          .set('Authorization', authorization)
          .send({}),
      ['Invalid salon update', 'サロンの変更の内容が正しくありません'],
      [
        [
          '',
          'custom',
          'At least one property must be specified',
          'プロパティを 1 つ以上指定してください',
        ],
      ],
    ],
    [
      'a search for salons with a limit below one',
      (app) => request(app).get(`${SALONS}?limit=0`),
      ['Invalid salon search', 'サロンの検索の条件が正しくありません'],
      [
        [
          'limit',
          'too_small',
          'Too small: expected number to be >=1',
          '小さすぎる値: numberは1以上である必要があります',
        ],
      ],
    ],
    [
      'a search for salons whose parameters are of no type of theirs',
      (app) => request(app).get(`${SALONS}?limit=ten&isActive=maybe`),
      ['Invalid salon search', 'サロンの検索の条件が正しくありません'],
      [
        ['limit', 'invalid_format', 'Must be a number', '数にしてください'],
        [
          'isActive',
          'invalid_value',
          'Must be true or false',
          'true か false にしてください',
        ],
      ],
    ],
    [
      'what is no ID of a salon',
      (app) => request(app).get(`${SALONS}/latest`),
      ['Invalid salon ID', 'サロンの ID が正しくありません'],
      [['id', 'invalid_format', 'Invalid UUID', '無効なUUID']],
    ],
    [
      'what is no ID of a salon, in the path of what belongs to a salon',
      (app) => request(app).get(`${SALONS}/latest/service-categories`),
      ['Invalid salon ID', 'サロンの ID が正しくありません'],
      [['salonId', 'invalid_format', 'Invalid UUID', '無効なUUID']],
    ],
  ])(
    'should tell %s in English to who asks for no language, and in Japanese to who asks for Japanese',
    async (_case, send, [detail, detailInJapanese], broken) => {
      // Arrange
      const app = createTestApp()
      const asAdmin = await signInAsAdmin(app, getTestDb())
      const created = await request(app)
        .post(SALONS)
        .set('Authorization', asAdmin)
        .send({ ...salon, email: 'first@example.com' })
      const salonId: string = created.body.data.id

      // Act
      const unasked = await send(app, asAdmin, salonId)
      const asked = await send(app, asAdmin, salonId).set(
        'Accept-Language',
        'ja',
      )

      // Assert
      expect(unasked.status).toBe(400)
      expect(unasked.headers['content-language']).toBe('en')
      expect(unasked.body).toMatchObject({
        title: 'Validation failed',
        detail,
        errors: broken.map(([field, rule, message]) => ({
          field,
          rule,
          message,
          value: null,
          constraint: null,
        })),
      })
      expect(asked.status).toBe(400)
      expect(asked.headers['content-language']).toBe('ja')
      expect(asked.body).toEqual({
        ...unasked.body,
        title: '入力の内容が正しくありません',
        detail: detailInJapanese,
        errors: broken.map(([field, rule, _message, messageInJapanese]) => ({
          field,
          rule,
          message: messageInJapanese,
          value: null,
          constraint: null,
        })),
        correlationId: asked.headers['x-request-id'],
        timestamp: expect.any(String),
      })
    },
  )

  it('should say that an error depends on the language asked for, and that a success does not', async () => {
    // Arrange
    const app = createTestApp()

    // Act
    const error = await request(app).get(UNKNOWN_PATH)
    const success = await request(app).get(SALONS).set('Accept-Language', 'ja')

    // Assert
    expect(error.headers['vary']).toMatch(/\bAccept-Language\b/)
    expect(success.status).toBe(200)
    expect(success.headers['vary']).not.toMatch(/Accept-Language/)
    expect(success.headers).not.toHaveProperty('content-language')
  })
})

describe('a failing database', () => {
  it('should answer 500 without the cause and log the cause under the request ID', async () => {
    const connection = connectUnreachableDatabase()
    const logs: unknown[] = []
    const app = createTestApp({ database: connection.database, logs })

    const response = await request(app).get(SALONS)
    await connection.close()

    expect(response.status).toBe(500)
    expect(response.headers['content-type']).toBe(PROBLEM_JSON)
    expect(response.body).toEqual({
      type: 'urn:beauty-salon:problem:database',
      title: 'Internal server error',
      status: 500,
      detail: null,
      instance: SALONS,
      code: '4003',
      errors: null,
      correlationId: response.headers['x-request-id'],
      timestamp: expect.any(String),
    })
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'error',
        req: expect.objectContaining({ id: response.headers['x-request-id'] }),
        msg: 'Failed to list salons',
        cause: expect.objectContaining({ code: 'ECONNREFUSED' }),
      }),
    )
  })

  it('should log the statement that failed without its values', async () => {
    const logs: unknown[] = []
    const app = createTestApp({ logs })
    const asAdmin = await signInAsAdmin(app, getTestDb())
    await getTestDb().execute(sql`ALTER TABLE salons DROP COLUMN "phoneNumber"`)

    const response = await request(app)
      .post(SALONS)
      .set('Authorization', asAdmin)
      .send(salon)

    expect(response.status).toBe(500)
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'error',
        msg: 'Failed to create salon',
        cause: {
          message: 'column "phoneNumber" of relation "salons" does not exist',
          code: '42703',
          constraint: null,
          table: null,
          column: null,
          query: expect.stringContaining('insert into "salons"'),
        },
      }),
    )
    expect(JSON.stringify(logs)).not.toContain(salon.email)
    expect(JSON.stringify(logs)).not.toContain(salon.phoneNumber)
  })
})

describe('cross-origin requests', () => {
  it('should let a page of a configured origin read the response', async () => {
    const response = await request(createTestApp())
      .get(SALONS)
      .set('Origin', ALLOWED_ORIGIN)

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('should let a page of a configured origin read the name of a file', async () => {
    const response = await request(createTestApp())
      .get(SALONS)
      .set('Origin', ALLOWED_ORIGIN)

    expect(response.headers['access-control-expose-headers']).toBe(
      'Content-Disposition',
    )
  })

  it('should not let a page of another origin read the response', async () => {
    const response = await request(createTestApp())
      .get(SALONS)
      .set('Origin', 'https://elsewhere.example')

    expect(response.headers).not.toHaveProperty('access-control-allow-origin')
  })

  it('should answer a preflight request with how long it may be cached', async () => {
    const response = await request(createTestApp())
      .options(SALONS)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')

    expect(response.status).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.headers['access-control-max-age']).toBe('600')
  })
})

describe('rate limit', () => {
  const rateLimit = { windowMs: 60_000, maxRequests: 2 }

  it('should say in the headers how much of the limit is left', async () => {
    const response = await request(createTestApp({ rateLimit })).get(SALONS)

    expect(response.status).toBe(200)
    expect(response.headers['ratelimit']).toContain('r=1')
    expect(response.headers['ratelimit-policy']).toContain('q=2')
  })

  it('should answer the request over the limit with 429 and when to retry', async () => {
    const app = createTestApp({ rateLimit })

    await request(app).get(SALONS)
    await request(app).get(SALONS)
    const response = await request(app).get(SALONS)

    expect(response.status).toBe(429)
    expect(response.headers['content-type']).toBe(PROBLEM_JSON)
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0)
    expect(response.body).toEqual({
      type: 'urn:beauty-salon:problem:rate-limited',
      title: 'Too many requests',
      status: 429,
      detail: 'Wait for the time in the Retry-After header before retrying',
      instance: SALONS,
      code: '4005',
      errors: null,
      correlationId: response.headers['x-request-id'],
      timestamp: expect.any(String),
    })
  })

  it('should count requests the API rejects', async () => {
    const app = createTestApp({ rateLimit })

    await request(app).get('/api/v1/stylists')
    await request(app).post(SALONS).send({})
    const response = await request(app).get(SALONS)

    expect(response.status).toBe(429)
  })

  it('should not count the probes', async () => {
    const app = createTestApp({ rateLimit })

    await request(app).get('/api/system/alive')
    await request(app).get('/api/system/ready')
    const response = await request(app).get('/api/system/alive')

    expect(response.status).toBe(200)
    expect(response.headers).not.toHaveProperty('ratelimit')
  })
})

describe('GET /api/system/alive', () => {
  it('should answer while the process runs, whatever the database does', async () => {
    const connection = connectUnreachableDatabase()
    const app = createTestApp({ database: connection.database })

    const response = await request(app).get('/api/system/alive')
    await connection.close()

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ alive: true })
    expect(response.headers['cache-control']).toBe('no-store')
  })
})

describe('GET /api/system/ready', () => {
  it('should answer 200 when the database answers', async () => {
    const response = await request(createTestApp()).get('/api/system/ready')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ready: true, reason: null })
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('should answer 503 naming the database when it is unreachable', async () => {
    const connection = connectUnreachableDatabase()
    const logs: unknown[] = []
    const app = createTestApp({ database: connection.database, logs })

    const response = await request(app).get('/api/system/ready')
    await connection.close()

    expect(response.status).toBe(503)
    expect(response.headers['content-type']).toBe(JSON_UTF8)
    expect(response.body).toEqual({ ready: false, reason: 'database' })
    expect(logs).toMatchObject([
      {
        level: 'error',
        msg: 'Database probe failed',
        error: {
          type: 'database',
          message: 'Database is unreachable',
          cause: { code: 'ECONNREFUSED' },
        },
      },
    ])
  })

  it('should not write successful probes to the request log', async () => {
    const logs: unknown[] = []
    const app = createTestApp({ logs })

    await request(app).get('/api/system/ready')
    await request(app).get('/api/system/alive')
    await request(app).get('/api/system/health')

    expect(logs).toEqual([])
  })
})

describe('GET /api/system/health', () => {
  it('should report the database as up with how long it took to answer', async () => {
    const response = await request(createTestApp()).get('/api/system/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'healthy',
      version: 'v1',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
      checks: [
        {
          name: 'database',
          status: 'up',
          responseTime: expect.any(Number),
          error: null,
          details: null,
        },
      ],
      metadata: null,
    })
  })

  it('should answer 503 and report the database as down when it is unreachable', async () => {
    const connection = connectUnreachableDatabase()
    const app = createTestApp({ database: connection.database })

    const response = await request(app).get('/api/system/health')
    await connection.close()

    expect(response.status).toBe(503)
    expect(response.headers['content-type']).toBe(JSON_UTF8)
    expect(response.body).toMatchObject({
      status: 'unhealthy',
      checks: [
        {
          name: 'database',
          status: 'down',
          error: 'Database is unreachable',
        },
      ],
    })
  })
})

describe('response headers', () => {
  it('should carry the security headers and not name the framework', async () => {
    const response = await request(createTestApp()).get(SALONS)

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['strict-transport-security']).toEqual(
      expect.any(String),
    )
    expect(response.headers).not.toHaveProperty('x-powered-by')
  })
})

describe('the user on the line of a request', () => {
  const REQUEST_ID = 'logged-request'

  type SignedIn = TestUser & Session

  type Context = {
    app: Express
    db: ReturnType<typeof getTestDb>
    logs: unknown[]
    admin: SignedIn
    customer: SignedIn
  }

  /** An app that logs into `logs`, with an administrator and a customer signed in. */
  const withTwoUsersSignedIn = async (): Promise<Context> => {
    const logs: unknown[] = []
    const app = createTestApp({ logs })
    const db = getTestDb()
    return {
      app,
      db,
      logs,
      admin: await signedInUser(app, db, { role: 'admin' }),
      customer: await signedInUser(app, db),
    }
  }

  /** The line the request with this ID completed with. */
  const lineOf = (logs: unknown[], requestId: string): object => {
    for (const logged of logs) {
      const found = match(logged)
        .with(
          { msg: 'request completed', req: { id: requestId } },
          (line) => line,
        )
        .otherwise(() => null)
      if (found !== null) {
        return found
      }
    }
    throw new Error(`No line for request ${requestId}`)
  }

  /** The tokens of a session, and what the server stores of them. */
  const secretsOf = ({
    accessToken,
    refreshToken,
  }: {
    accessToken: string
    refreshToken: string
  }): string[] => [
    accessToken,
    refreshToken,
    sha256(accessToken),
    sha256(refreshToken),
  ]

  const expectNoSecretIn = (logs: unknown[], secrets: string[]): void => {
    const logged = JSON.stringify(logs)
    for (const secret of secrets) {
      expect(logged).not.toContain(secret)
    }
  }

  it.each<[string, number, (context: Context) => Promise<[SignedIn, Test]>]>([
    [
      'reads the current user',
      200,
      async ({ app, customer }) => [
        customer,
        request(app)
          .get(`${AUTH}/me`)
          .set('Authorization', customer.authorization),
      ],
    ],
    [
      'lists the sessions of the user',
      200,
      async ({ app, customer }) => [
        customer,
        request(app)
          .get(`${AUTH}/sessions`)
          .set('Authorization', customer.authorization),
      ],
    ],
    [
      'lists the sessions after one that it names',
      200,
      async ({ app, db, customer }) => {
        const { id } = await insertSession(db, customer.id)
        return [
          customer,
          request(app)
            .get(`${AUTH}/sessions?cursor=${id}`)
            .set('Authorization', customer.authorization),
        ]
      },
    ],
    [
      'ends a session that it names',
      204,
      async ({ app, db, customer }) => {
        const { id } = await insertSession(db, customer.id)
        return [
          customer,
          request(app)
            .delete(`${AUTH}/sessions/${id}`)
            .set('Authorization', customer.authorization),
        ]
      },
    ],
    [
      'creates a salon',
      201,
      async ({ app, admin }) => [
        admin,
        request(app)
          .post(SALONS)
          .set('Authorization', admin.authorization)
          .send({ ...salon, email: 'logged@example.com' }),
      ],
    ],
    [
      'breaks a rule of the query',
      400,
      async ({ app, customer }) => [
        customer,
        request(app)
          .get(`${AUTH}/sessions?limit=0`)
          .set('Authorization', customer.authorization),
      ],
    ],
    [
      'asks for what only an administrator may do',
      403,
      async ({ app, admin, customer }) => [
        customer,
        request(app)
          .get(`${ADMIN_AUTH}/users/${admin.id}`)
          .set('Authorization', customer.authorization),
      ],
    ],
    [
      'names a user that does not exist',
      404,
      async ({ app, admin }) => [
        admin,
        request(app)
          .get(`${ADMIN_AUTH}/users/${UNKNOWN_ID}`)
          .set('Authorization', admin.authorization),
      ],
    ],
    [
      'unlocks an account that is not locked',
      409,
      async ({ app, admin, customer }) => [
        admin,
        request(app)
          .post(`${ADMIN_AUTH}/unlock/${customer.id}`)
          .set('Authorization', admin.authorization),
      ],
    ],
  ])(
    'should name the signed-in user, and no session or token, on the line of a request that %s (%i)',
    async (_case, status, arrange) => {
      const context = await withTwoUsersSignedIn()
      const [actor, pending] = await arrange(context)

      const response = await pending.set('X-Request-Id', REQUEST_ID)

      expect(response.status).toBe(status)
      const line = lineOf(context.logs, REQUEST_ID)
      expect(line).toMatchObject({
        res: { statusCode: status },
        userId: actor.id,
      })
      expect(line).not.toHaveProperty('sessionId')
      expectNoSecretIn(context.logs, [
        ...secretsOf(context.admin),
        ...secretsOf(context.customer),
      ])
    },
  )

  it('should add nothing but the user to the line of an authenticated request', async () => {
    const { app, logs, customer } = await withTwoUsersSignedIn()

    await request(app)
      .get(`${AUTH}/me`)
      .set('Authorization', customer.authorization)
      .set('X-Request-Id', 'authenticated')
    await request(app).get(SALONS).set('X-Request-Id', 'public')

    expect(Object.keys(lineOf(logs, 'authenticated')).sort()).toEqual(
      [...Object.keys(lineOf(logs, 'public')), 'userId'].sort(),
    )
  })

  it('should keep the users of requests at the same moment apart', async () => {
    const { app, logs, admin, customer } = await withTwoUsersSignedIn()

    await Promise.all([
      request(app)
        .get(`${AUTH}/me`)
        .set('Authorization', admin.authorization)
        .set('X-Request-Id', 'of-the-admin'),
      request(app)
        .get(`${AUTH}/me`)
        .set('Authorization', customer.authorization)
        .set('X-Request-Id', 'of-the-customer'),
      request(app).get(`${AUTH}/me`).set('X-Request-Id', 'of-nobody'),
    ])

    expect(lineOf(logs, 'of-the-admin')).toMatchObject({ userId: admin.id })
    expect(lineOf(logs, 'of-the-customer')).toMatchObject({
      userId: customer.id,
    })
    expect(lineOf(logs, 'of-nobody')).not.toHaveProperty('userId')
  })

  it.each<
    [string, string, (context: Context) => Promise<[string | null, string[]]>]
  >([
    ['no access token', '1001', async () => [null, []]],
    [
      'a token that names no session',
      '1004',
      async () => {
        const token = 't'.repeat(43)
        return [`Bearer ${token}`, [token, sha256(token)]]
      },
    ],
    [
      'a refresh token',
      '1004',
      async ({ customer }) => [`Bearer ${customer.refreshToken}`, []],
    ],
    [
      'an access token that has run out',
      '1003',
      async ({ db, customer }) => {
        const expired = await insertSession(db, customer.id, {
          expiresAt: minutesFromNow(-1),
        })
        return [expired.authorization, secretsOf(expired)]
      },
    ],
  ])(
    'should name no user, and log no token, for a request refused with 401 for %s',
    async (_case, code, arrange) => {
      const context = await withTwoUsersSignedIn()
      const [authorization, secrets] = await arrange(context)
      const pending = request(context.app)
        .get(`${AUTH}/sessions`)
        .set('X-Request-Id', REQUEST_ID)

      const response = await (authorization === null
        ? pending
        : pending.set('Authorization', authorization))

      expect(response.status).toBe(401)
      expect(response.body.code).toBe(code)
      const line = lineOf(context.logs, REQUEST_ID)
      expect(line).toMatchObject({ res: { statusCode: 401 } })
      expect(line).not.toHaveProperty('userId')
      expect(line).not.toHaveProperty('sessionId')
      expectNoSecretIn(context.logs, [
        ...secrets,
        ...secretsOf(context.admin),
        ...secretsOf(context.customer),
      ])
    },
  )

  it('should name no user, and log no token it issues, on the line of a login', async () => {
    const logs: unknown[] = []
    const app = createTestApp({ logs })
    const { email } = await insertUser(getTestDb())

    const response = await request(app)
      .post(`${AUTH}/login`)
      .set('X-Request-Id', REQUEST_ID)
      .send(loginBody(email))

    expect(response.status).toBe(200)
    const { accessToken, refreshToken } = response.body.data
    const line = lineOf(logs, REQUEST_ID)
    expect(line).toMatchObject({ res: { statusCode: 200 } })
    expect(line).not.toHaveProperty('userId')
    expectNoSecretIn(logs, secretsOf({ accessToken, refreshToken }))
  })

  it.each([
    ['without a token', false],
    ['with the token of a signed-in user', true],
  ])(
    'should name no user on the line of the list of salons, asked for %s',
    async (_case, withToken) => {
      const context = await withTwoUsersSignedIn()
      const pending = request(context.app)
        .get(SALONS)
        .set('X-Request-Id', REQUEST_ID)

      const response = await (withToken
        ? pending.set('Authorization', context.customer.authorization)
        : pending)

      expect(response.status).toBe(200)
      expect(lineOf(context.logs, REQUEST_ID)).not.toHaveProperty('userId')
    },
  )
})
