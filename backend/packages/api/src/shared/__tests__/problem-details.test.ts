import { type DomainError, DomainErrors } from '@beauty-salon-backend/domain'
import type { Locale, LocalizedText } from '@beauty-salon-shared/i18n'
import {
  authMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  type ApiError,
  type HttpError,
  languageOf,
  type ProblemDetails,
  toBearerChallenge,
  toProblemDetails,
} from '../problem-details'

const context = {
  instance: '/api/v1/salons',
  correlationId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b',
  timestamp: '2026-11-14T09:00:00.000Z',
}

describe('toProblemDetails', () => {
  it('presents a validation error as 400 with one entry per broken rule', () => {
    const problem = toProblemDetails(
      DomainErrors.validation('Invalid salon', [
        {
          field: 'email',
          rule: 'invalid_format',
          message: {
            en: 'Invalid email',
            ja: 'メールアドレスが正しくありません',
          },
        },
        {
          field: 'openingHours.0.date',
          rule: 'custom',
          message: { en: 'Repeated', ja: '繰り返しています' },
        },
      ]),
      context,
      'en',
    )

    expect(problem).toEqual({
      type: 'urn:beauty-salon:problem:validation',
      title: 'Validation failed',
      status: 400,
      detail: 'Invalid salon',
      code: '2001',
      errors: [
        {
          field: 'email',
          rule: 'invalid_format',
          message: 'Invalid email',
          value: null,
          constraint: null,
        },
        {
          field: 'openingHours.0.date',
          rule: 'custom',
          message: 'Repeated',
          value: null,
          constraint: null,
        },
      ],
      ...context,
    })
  })

  it('presents a missing entity as 404', () => {
    const problem = toProblemDetails(
      DomainErrors.notFound(
        entityMessages.salon,
        '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
      ),
      context,
      'en',
    )

    expect(problem).toMatchObject({
      type: 'urn:beauty-salon:problem:not-found',
      status: 404,
      detail: 'Salon 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c was not found',
      code: '3001',
      errors: null,
    })
  })

  it('presents a duplicate as 409 naming the property and the value', () => {
    const problem = toProblemDetails(
      DomainErrors.alreadyExists(
        entityMessages.salon,
        'email',
        'aoyama@example.com',
      ),
      context,
      'en',
    )

    expect(problem).toMatchObject({
      type: 'urn:beauty-salon:problem:already-exists',
      status: 409,
      detail: 'Salon with email aoyama@example.com already exists',
      code: '3002',
      errors: null,
    })
  })

  it('presents a database error as 500 without revealing its message or cause', () => {
    const problem = toProblemDetails(
      DomainErrors.database(
        'Failed to create salon',
        new Error('relation "salons" does not exist'),
      ),
      context,
      'en',
    )

    expect(problem).toEqual({
      type: 'urn:beauty-salon:problem:database',
      title: 'Internal server error',
      status: 500,
      detail: null,
      code: '4003',
      errors: null,
      ...context,
    })
    expect(JSON.stringify(problem)).not.toContain('salons" does not exist')
  })

  it.each<
    [HttpError, Pick<ProblemDetails, 'type' | 'status' | 'code' | 'detail'>]
  >([
    [
      { type: 'routeNotFound', method: 'PUT', path: '/api/v1/salons' },
      {
        type: 'urn:beauty-salon:problem:route-not-found',
        status: 404,
        code: '3001',
        detail: 'PUT /api/v1/salons is not part of the API',
      },
    ],
    [
      { type: 'malformedBody' },
      {
        type: 'urn:beauty-salon:problem:malformed-body',
        status: 400,
        code: '2002',
        detail: 'The request body is not valid JSON',
      },
    ],
    [
      { type: 'unsupportedMediaType' },
      {
        type: 'urn:beauty-salon:problem:unsupported-media-type',
        status: 415,
        code: '2002',
        detail: 'The request body must be application/json in UTF-8',
      },
    ],
    [
      { type: 'bodyTooLarge' },
      {
        type: 'urn:beauty-salon:problem:body-too-large',
        status: 413,
        code: '2004',
        detail: 'The request body exceeds 100000 bytes',
      },
    ],
    [
      { type: 'badRequest' },
      {
        type: 'urn:beauty-salon:problem:bad-request',
        status: 400,
        code: '2002',
        detail: null,
      },
    ],
    [
      { type: 'rateLimited' },
      {
        type: 'urn:beauty-salon:problem:rate-limited',
        status: 429,
        code: '4005',
        detail: 'Wait for the time in the Retry-After header before retrying',
      },
    ],
    [
      { type: 'unexpected' },
      {
        type: 'urn:beauty-salon:problem:internal',
        status: 500,
        code: '4001',
        detail: null,
      },
    ],
  ])(
    'presents the HTTP error %j with its own type, status and code',
    (error, expected) => {
      expect(toProblemDetails(error, context, 'en')).toEqual({
        ...expected,
        title: expect.any(String),
        errors: null,
        ...context,
      })
    },
  )
})

describe('toProblemDetails for authentication and authorization', () => {
  it.each<
    [string, DomainError, Pick<ProblemDetails, 'type' | 'status' | 'code'>]
  >([
    [
      'a request without credentials',
      DomainErrors.unauthenticated('missingCredentials'),
      {
        type: 'urn:beauty-salon:problem:authentication-required',
        status: 401,
        code: '1001',
      },
    ],
    [
      'a failed login',
      DomainErrors.unauthenticated('invalidCredentials'),
      {
        type: 'urn:beauty-salon:problem:invalid-credentials',
        status: 401,
        code: '1002',
      },
    ],
    [
      'an access token that has expired',
      DomainErrors.unauthenticated('expiredToken'),
      {
        type: 'urn:beauty-salon:problem:token-expired',
        status: 401,
        code: '1003',
      },
    ],
    [
      'a token that cannot be used',
      DomainErrors.unauthenticated('invalidToken'),
      {
        type: 'urn:beauty-salon:problem:invalid-token',
        status: 401,
        code: '1004',
      },
    ],
    [
      'an actor who may not do this',
      DomainErrors.forbidden(),
      { type: 'urn:beauty-salon:problem:forbidden', status: 403, code: '1005' },
    ],
  ])(
    'presents %s with its own type, status and code',
    (_case, error, expected) => {
      expect(toProblemDetails(error, context, 'en')).toEqual({
        ...expected,
        title: expect.any(String),
        detail: expect.any(String),
        errors: null,
        ...context,
      })
    },
  )

  it('says of a failed login only that the email or the password is wrong', () => {
    const problem = toProblemDetails(
      DomainErrors.unauthenticated('invalidCredentials'),
      context,
      'en',
    )

    expect(problem.detail).toBe('Invalid email or password')
  })

  it('presents a login that needs a two-factor code as 401 with the code 1007', () => {
    const problem = toProblemDetails(
      DomainErrors.unauthenticated('twoFactorRequired'),
      context,
      'en',
    )

    expect(problem).toEqual({
      type: 'urn:beauty-salon:problem:two-factor-required',
      title: 'Two-factor authentication required',
      status: 401,
      detail: expect.any(String),
      code: '1007',
      errors: null,
      ...context,
    })
  })

  it('does not present a login that needs a two-factor code as a failed login', () => {
    const needsCode = toProblemDetails(
      DomainErrors.unauthenticated('twoFactorRequired'),
      context,
      'en',
    )
    const failed = toProblemDetails(
      DomainErrors.unauthenticated('invalidCredentials'),
      context,
      'en',
    )

    expect(needsCode.code).not.toBe(failed.code)
    expect(needsCode.type).not.toBe(failed.type)
    expect(needsCode.title).not.toBe(failed.title)
    expect(needsCode.detail).not.toBe(failed.detail)
  })

  it('says of a login that needs a two-factor code nothing about a code that was sent', () => {
    const problem = toProblemDetails(
      DomainErrors.unauthenticated('twoFactorRequired'),
      context,
      'en',
    )

    expect(problem.detail).not.toMatch(
      /wrong|incorrect|invalid code|used|expired|missing/i,
    )
  })
})

describe('toProblemDetails for an operation that the state does not allow', () => {
  it('presents a conflict as 409 with the code 3003 and its message as the detail', () => {
    const problem = toProblemDetails(
      DomainErrors.conflict(authMessages.twoFactorAlreadyEnabled),
      context,
      'en',
    )

    expect(problem).toEqual({
      type: 'urn:beauty-salon:problem:operation-not-allowed',
      title: 'Operation not allowed',
      status: 409,
      detail: 'Two-factor authentication is already enabled',
      code: '3003',
      errors: null,
      ...context,
    })
  })

  it.each<[Locale, LocalizedText, string]>([
    [
      'en',
      authMessages.twoFactorNotEnabled,
      'Two-factor authentication is not enabled',
    ],
    [
      'ja',
      authMessages.twoFactorNotEnabled,
      '2 要素認証は、有効になっていません',
    ],
    [
      'en',
      authMessages.noTwoFactorSetupUnderWay,
      'No setup of two-factor authentication is under way',
    ],
    [
      'ja',
      authMessages.noTwoFactorSetupUnderWay,
      '2 要素認証の設定は、始まっていません',
    ],
  ])(
    'should give the message of a conflict as the detail, as it is written in %s',
    (language, message, detail) => {
      // Act
      const problem = toProblemDetails(
        DomainErrors.conflict(message),
        context,
        language,
      )

      // Assert
      expect(problem.detail).toBe(detail)
    },
  )

  it('does not present a conflict as a duplicate, which is the other 409', () => {
    const conflict = toProblemDetails(
      DomainErrors.conflict(authMessages.twoFactorNotEnabled),
      context,
      'en',
    )
    const duplicate = toProblemDetails(
      DomainErrors.alreadyExists(
        entityMessages.salon,
        'email',
        'aoyama@example.com',
      ),
      context,
      'en',
    )

    expect(conflict.status).toBe(duplicate.status)
    expect(conflict.code).not.toBe(duplicate.code)
    expect(conflict.type).not.toBe(duplicate.type)
  })
})

/** What a problem reads: its title and its detail. */
type Told = Pick<ProblemDetails, 'title' | 'detail'>

/** The errors that are told in the language asked for, with what they read in each language. */
const TOLD_BY_THE_API: [string, ApiError, Told, Told][] = [
  [
    'a request without credentials',
    DomainErrors.unauthenticated('missingCredentials'),
    {
      title: 'Authentication required',
      detail:
        'Send the access token in the Authorization header as a Bearer token',
    },
    {
      title: '認証が必要です',
      detail:
        'アクセストークンを、Authorization ヘッダーに Bearer トークンとして送ってください',
    },
  ],
  [
    'a token that cannot be used',
    DomainErrors.unauthenticated('invalidToken'),
    {
      title: 'Invalid token',
      detail: 'The token cannot be used; sign in again',
    },
    {
      title: 'トークンが無効です',
      detail: 'このトークンは使えません。もう一度サインインしてください',
    },
  ],
  [
    'an access token that has expired',
    DomainErrors.unauthenticated('expiredToken'),
    {
      title: 'Token expired',
      detail:
        'The access token has expired; get a new one with the refresh token',
    },
    {
      title: 'トークンの有効期限が切れています',
      detail:
        'アクセストークンの有効期限が切れています。リフレッシュトークンで、新しいトークンを受け取ってください',
    },
  ],
  [
    'a failed login',
    DomainErrors.unauthenticated('invalidCredentials'),
    { title: 'Login failed', detail: 'Invalid email or password' },
    {
      title: 'サインインできませんでした',
      detail: 'メールアドレスかパスワードが正しくありません',
    },
  ],
  [
    'a login that needs a two-factor code',
    DomainErrors.unauthenticated('twoFactorRequired'),
    {
      title: 'Two-factor authentication required',
      detail:
        'Send a valid code of the authenticator app, or a backup code, as twoFactorCode',
    },
    {
      title: '2 要素認証が必要です',
      detail:
        '認証アプリの有効なコードかバックアップコードを、twoFactorCode として送ってください',
    },
  ],
  [
    'an actor who may not do this',
    DomainErrors.forbidden(),
    { title: 'Forbidden', detail: 'This account is not allowed to do this' },
    {
      title: '許可されていません',
      detail: 'このアカウントでは、この操作はできません',
    },
  ],
  [
    'a share link whose password is missing or wrong',
    DomainErrors.passwordRequired(),
    {
      title: 'Password required',
      detail:
        'Send the password of the share link; one that was sent was not accepted',
    },
    {
      title: 'パスワードが必要です',
      detail:
        '共有リンクのパスワードを送ってください。送られたパスワードは、受け付けられませんでした',
    },
  ],
  [
    'a missing entity',
    DomainErrors.notFound(
      entityMessages.salon,
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ),
    {
      title: 'Resource not found',
      detail: 'Salon 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c was not found',
    },
    {
      title: 'リソースが見つかりません',
      detail:
        'サロンが見つかりません（ID: 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c）',
    },
  ],
  [
    'a missing entity that is looked for by what is not repeated',
    DomainErrors.notFound(entityMessages.shareLinkOfToken, null),
    {
      title: 'Resource not found',
      detail: 'Share link of the token was not found',
    },
    {
      title: 'リソースが見つかりません',
      detail: 'このトークンの共有リンクが見つかりません',
    },
  ],
  [
    'a duplicate',
    DomainErrors.alreadyExists(
      entityMessages.salon,
      'email',
      'aoyama@example.com',
    ),
    {
      title: 'Resource already exists',
      detail: 'Salon with email aoyama@example.com already exists',
    },
    {
      title: 'リソースがすでにあります',
      detail: 'email が aoyama@example.com のサロンは、すでにあります',
    },
  ],
  [
    'a conflict',
    DomainErrors.conflict(authMessages.twoFactorAlreadyEnabled),
    {
      title: 'Operation not allowed',
      detail: 'Two-factor authentication is already enabled',
    },
    {
      title: 'この操作はできません',
      detail: '2 要素認証は、すでに有効になっています',
    },
  ],
  [
    'a database error',
    DomainErrors.database('Failed to create salon', null),
    { title: 'Internal server error', detail: null },
    { title: 'サーバーでエラーが起きました', detail: null },
  ],
  [
    'an error of the object storage',
    DomainErrors.storage('Failed to store the file', null),
    { title: 'Internal server error', detail: null },
    { title: 'サーバーでエラーが起きました', detail: null },
  ],
  [
    'an unknown route',
    { type: 'routeNotFound', method: 'PUT', path: '/api/v1/salons' },
    {
      title: 'Route not found',
      detail: 'PUT /api/v1/salons is not part of the API',
    },
    {
      title: 'ルートが見つかりません',
      detail: 'PUT /api/v1/salons は、この API にありません',
    },
  ],
  [
    'a malformed body',
    { type: 'malformedBody' },
    {
      title: 'Malformed request body',
      detail: 'The request body is not valid JSON',
    },
    {
      title: 'リクエストの本文を読めません',
      detail: 'リクエストの本文が、正しい JSON ではありません',
    },
  ],
  [
    'a media type the API does not read',
    { type: 'unsupportedMediaType' },
    {
      title: 'Unsupported media type',
      detail: 'The request body must be application/json in UTF-8',
    },
    {
      title: '受け付けていないメディアタイプです',
      detail: 'リクエストの本文は、UTF-8 の application/json にしてください',
    },
  ],
  [
    'a body over the size limit',
    { type: 'bodyTooLarge' },
    {
      title: 'Request body too large',
      detail: 'The request body exceeds 100000 bytes',
    },
    {
      title: 'リクエストの本文が大きすぎます',
      detail: 'リクエストの本文が 100000 バイトを超えています',
    },
  ],
  [
    'a request the API cannot read',
    { type: 'badRequest' },
    { title: 'Bad request', detail: null },
    { title: 'リクエストが正しくありません', detail: null },
  ],
  [
    'the rate limit',
    { type: 'rateLimited' },
    {
      title: 'Too many requests',
      detail: 'Wait for the time in the Retry-After header before retrying',
    },
    {
      title: 'リクエストが多すぎます',
      detail:
        'Retry-After ヘッダーの時間だけ待ってから、もう一度送ってください',
    },
  ],
  [
    'an unexpected failure',
    { type: 'unexpected' },
    { title: 'Internal server error', detail: null },
    { title: 'サーバーでエラーが起きました', detail: null },
  ],
]

/** The errors of which the domain writes a text in English alone, with what they read. */
const TOLD_BY_THE_DOMAIN: [string, DomainError, Told][] = [
  [
    'a validation error with a headline in English alone',
    DomainErrors.validation('Invalid salon', []),
    { title: 'Validation failed', detail: 'Invalid salon' },
  ],
]

const LANGUAGES: Locale[] = ['en', 'ja']

describe('toProblemDetails in the language that is asked for', () => {
  it.each(TOLD_BY_THE_API)(
    'should tell %s in English when English is asked for',
    (_case, error, english) => {
      // Act
      const problem = toProblemDetails(error, context, 'en')

      // Assert
      expect(problem).toMatchObject(english)
    },
  )

  it.each(TOLD_BY_THE_API)(
    'should tell %s in Japanese when Japanese is asked for',
    (_case, error, _english, japanese) => {
      // Act
      const problem = toProblemDetails(error, context, 'ja')

      // Assert
      expect(problem).toMatchObject(japanese)
    },
  )

  it.each(TOLD_BY_THE_API)(
    'should change nothing of %s but its title and its detail',
    (_case, error) => {
      // Act
      const english = toProblemDetails(error, context, 'en')
      const japanese = toProblemDetails(error, context, 'ja')

      // Assert
      expect(japanese).toEqual({
        ...english,
        title: japanese.title,
        detail: japanese.detail,
      })
    },
  )

  it.each(
    TOLD_BY_THE_DOMAIN.flatMap(([name, error, told]) =>
      LANGUAGES.map((asked): [string, Locale, DomainError, Told] => [
        name,
        asked,
        error,
        told,
      ]),
    ),
  )(
    'should tell %s in English when %s is asked for',
    (_case, asked, error, english) => {
      // Act
      const problem = toProblemDetails(error, context, asked)

      // Assert
      expect(problem).toMatchObject(english)
    },
  )
})

describe('languageOf', () => {
  it.each(
    TOLD_BY_THE_API.flatMap(([name, error]) =>
      LANGUAGES.map((asked): [string, Locale, ApiError] => [
        name,
        asked,
        error,
      ]),
    ),
  )('should tell %s in the language asked for (%s)', (_case, asked, error) => {
    // Act
    const language = languageOf(error, asked)

    // Assert
    expect(language).toBe(asked)
  })

  it.each(
    TOLD_BY_THE_DOMAIN.flatMap(([name, error]) =>
      LANGUAGES.map((asked): [string, Locale, ApiError] => [
        name,
        asked,
        error,
      ]),
    ),
  )(
    'should tell %s in English whatever is asked for (%s)',
    (_case, asked, error) => {
      // Act
      const language = languageOf(error, asked)

      // Assert
      expect(language).toBe('en')
    },
  )
})

const HEADLINE: LocalizedText = {
  en: 'Invalid salon',
  ja: 'サロンの内容が正しくありません',
}

const BLANK: LocalizedText = {
  en: 'Must not be blank',
  ja: '空白だけにはできません',
}

const TOO_LONG: LocalizedText = {
  en: 'Too big: expected string to have <=255 characters',
  ja: '大きすぎる値: stringは255文字以下である必要があります',
}

/** A validation error whose headline is written in every language, as what it says of each broken rule is. */
const WRITTEN_IN_EVERY_LANGUAGE = DomainErrors.validation(HEADLINE, [
  { field: 'name', rule: 'invalid_format', message: BLANK },
  { field: 'city', rule: 'too_big', message: TOO_LONG },
])

/**
 * A validation error whose headline is written in English alone. What it
 * says of each broken rule is written in every language.
 */
const HEADLINE_IN_ENGLISH_ALONE = DomainErrors.validation('Invalid salon', [
  { field: 'name', rule: 'invalid_format', message: BLANK },
  { field: 'city', rule: 'too_big', message: TOO_LONG },
])

/** What such an error says, whoever asks. */
const IN_ENGLISH = {
  title: 'Validation failed',
  detail: 'Invalid salon',
  errors: [
    {
      field: 'name',
      rule: 'invalid_format',
      message: 'Must not be blank',
      value: null,
      constraint: null,
    },
    {
      field: 'city',
      rule: 'too_big',
      message: 'Too big: expected string to have <=255 characters',
      value: null,
      constraint: null,
    },
  ],
}

describe('a validation error in the language that is asked for', () => {
  it('should be told in English to who asks for English', () => {
    // Act
    const problem = toProblemDetails(WRITTEN_IN_EVERY_LANGUAGE, context, 'en')

    // Assert
    expect(problem).toMatchObject(IN_ENGLISH)
  })

  it('should be told in Japanese to who asks for Japanese, when its headline is written in it', () => {
    // Act
    const problem = toProblemDetails(WRITTEN_IN_EVERY_LANGUAGE, context, 'ja')

    // Assert
    expect(problem).toMatchObject({
      title: '入力の内容が正しくありません',
      detail: 'サロンの内容が正しくありません',
      errors: [
        {
          field: 'name',
          rule: 'invalid_format',
          message: '空白だけにはできません',
          value: null,
          constraint: null,
        },
        {
          field: 'city',
          rule: 'too_big',
          message: '大きすぎる値: stringは255文字以下である必要があります',
          value: null,
          constraint: null,
        },
      ],
    })
  })

  it('should differ between the languages in what it says alone', () => {
    // Act
    const english = toProblemDetails(WRITTEN_IN_EVERY_LANGUAGE, context, 'en')
    const japanese = toProblemDetails(WRITTEN_IN_EVERY_LANGUAGE, context, 'ja')

    // Assert
    expect({
      ...japanese,
      title: english.title,
      detail: english.detail,
      errors: english.errors,
    }).toEqual(english)
    expect(japanese.errors?.map(({ field, rule }) => [field, rule])).toEqual(
      english.errors?.map(({ field, rule }) => [field, rule]),
    )
  })

  it.each(LANGUAGES)(
    'should be told in the language asked for (%s) when it has a headline in every language and no issue',
    (asked) => {
      // Act
      const language = languageOf(DomainErrors.validation(HEADLINE, []), asked)

      // Assert
      expect(language).toBe(asked)
    },
  )

  it.each(LANGUAGES)(
    'should be told in the language asked for (%s) when its headline is written in every language',
    (asked) => {
      // Act
      const language = languageOf(WRITTEN_IN_EVERY_LANGUAGE, asked)

      // Assert
      expect(language).toBe(asked)
    },
  )

  it.each(LANGUAGES)(
    'should be told in English as a whole when its headline is written in English alone, whatever is asked for (%s)',
    (asked) => {
      // Act
      const language = languageOf(HEADLINE_IN_ENGLISH_ALONE, asked)
      const problem = toProblemDetails(
        HEADLINE_IN_ENGLISH_ALONE,
        context,
        asked,
      )

      // Assert
      expect(language).toBe('en')
      expect(problem).toMatchObject(IN_ENGLISH)
    },
  )
})

describe('toBearerChallenge', () => {
  const plain = 'Bearer realm="beauty-salon-api"'
  const invalidToken = 'Bearer realm="beauty-salon-api", error="invalid_token"'

  it.each<[string, ApiError, string]>([
    [
      'a request without credentials',
      DomainErrors.unauthenticated('missingCredentials'),
      plain,
    ],
    [
      'a failed login',
      DomainErrors.unauthenticated('invalidCredentials'),
      plain,
    ],
    [
      'a login that needs a two-factor code',
      DomainErrors.unauthenticated('twoFactorRequired'),
      plain,
    ],
    [
      'a token that cannot be used',
      DomainErrors.unauthenticated('invalidToken'),
      invalidToken,
    ],
    [
      'an access token that has expired',
      DomainErrors.unauthenticated('expiredToken'),
      invalidToken,
    ],
  ])('challenges %s with %j', (_case, error, expected) => {
    expect(toBearerChallenge(error)).toBe(expected)
  })

  it.each<[string, ApiError]>([
    ['a forbidden action', DomainErrors.forbidden()],
    ['a validation error', DomainErrors.validation('Invalid', [])],
    ['a missing entity', DomainErrors.notFound(entityMessages.salon, 'x')],
    [
      'a duplicate',
      DomainErrors.alreadyExists(entityMessages.salon, 'email', 'a@b.jp'),
    ],
    ['a conflict', DomainErrors.conflict(authMessages.twoFactorNotEnabled)],
    ['a database error', DomainErrors.database('Failed', null)],
    ['an unknown route', { type: 'routeNotFound', method: 'GET', path: '/' }],
    ['a malformed body', { type: 'malformedBody' }],
    ['the rate limit', { type: 'rateLimited' }],
    ['an unexpected failure', { type: 'unexpected' }],
  ])('has no challenge for %s', (_case, error) => {
    expect(toBearerChallenge(error)).toBeNull()
  })
})
