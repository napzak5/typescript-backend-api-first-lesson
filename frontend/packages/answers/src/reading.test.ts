import type { ModelsProblemDetails } from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { describe, expect, it, vi } from 'vitest'
import {
  FAILED,
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  type Page,
  type Problem,
  PUBLIC_REFUSED_PARTS,
  PUBLIC_UNANSWERED_PARTS,
  pageOf,
  REFUSED_PARTS,
  type Refused,
  refusedValuesOf,
  TOO_MANY_REQUESTS,
  toTheEnd,
  UNANSWERED_PARTS,
  UNREAD_TYPES,
  type Unread,
  unreadMessageOf,
  unreadOf,
  unsentMessageOf,
  whyUnread,
} from './reading'

const details = (status: number): ModelsProblemDetails => ({
  type: 'urn:beauty-salon:problem',
  title: 'Problem',
  status,
  detail: null,
  instance: null,
  code: '2001',
  errors: null,
  correlationId: null,
  timestamp: '2026-11-20T00:00:00.000Z',
})

const problem = <Status extends number>(status: Status): Problem<Status> => ({
  status,
  data: details(status),
})

describe('unreadOf', () => {
  it('should ask for patience after too many requests', () => {
    expect(unreadOf(problem(429))).toEqual(TOO_MANY_REQUESTS)
  })

  it.each<[string, Refused]>([
    ['no answer', null],
    ['a value the screens should not have sent', problem(400)],
    ['a session that could not be renewed', problem(401)],
    ['a failure of the API', problem(500)],
  ])('should be a failure after %s', (_, answer) => {
    expect(unreadOf(answer)).toEqual(FAILED)
  })
})

/** What a request of the screens makes of every answer, with the parts of the patterns */
type Answer = { status: 200; data: string } | Refused | Problem<404>

const readWithRefused = (answer: Answer): string | Unread | NotFound =>
  match(answer)
    .returnType<string | Unread | NotFound>()
    .with({ status: 200 }, ({ data }) => data)
    .with({ status: 404 }, () => NOT_FOUND)
    .with(P.union(...REFUSED_PARTS), unreadOf)
    .exhaustive()

const readWithUnanswered = (answer: Answer): string | Unread | NotFound =>
  match(answer)
    .returnType<string | Unread | NotFound>()
    .with({ status: 200 }, ({ data }) => data)
    .with({ status: 400 }, () => 'refused')
    .with({ status: 404 }, () => NOT_FOUND)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive()

/** What a request makes of every answer of an operation that needs no session */
type PublicAnswer =
  | { status: 200; data: string }
  | Problem<400>
  | Problem<404>
  | Problem<429>
  | Problem<500>
  | null

const readPublic = (answer: PublicAnswer): string | Unread | NotFound =>
  match(answer)
    .returnType<string | Unread | NotFound>()
    .with({ status: 200 }, ({ data }) => data)
    .with({ status: 404 }, () => NOT_FOUND)
    .with(P.union(...PUBLIC_REFUSED_PARTS), unreadOf)
    .exhaustive()

const readPublicWithUnanswered = (
  answer: PublicAnswer,
): string | Unread | NotFound =>
  match(answer)
    .returnType<string | Unread | NotFound>()
    .with({ status: 200 }, ({ data }) => data)
    .with({ status: 400 }, () => 'refused')
    .with({ status: 404 }, () => NOT_FOUND)
    .with(P.union(...PUBLIC_UNANSWERED_PARTS), unreadOf)
    .exhaustive()

describe('the parts of the patterns', () => {
  it.each<[string, Answer, string | Unread | NotFound]>([
    ['what was asked for', { status: 200, data: 'read' }, 'read'],
    ['nothing at the address', problem(404), NOT_FOUND],
    ['no answer', null, FAILED],
    ['a value the API did not take', problem(400), FAILED],
    ['a session that could not be renewed', problem(401), FAILED],
    ['too many requests', problem(429), TOO_MANY_REQUESTS],
    ['a failure of the API', problem(500), FAILED],
  ])('should read %s with the answers that are refused', (_, answer, read) => {
    expect(readWithRefused(answer)).toEqual(read)
  })

  it('should leave a 400 to the match with the answers that say nothing', () => {
    expect(readWithUnanswered(problem(400))).toBe('refused')
    expect(readWithUnanswered(null)).toEqual(FAILED)
    expect(readWithUnanswered(problem(429))).toEqual(TOO_MANY_REQUESTS)
  })

  it.each<[Unread | NotFound, boolean]>([
    [FAILED, true],
    [TOO_MANY_REQUESTS, true],
    [NOT_FOUND, false],
  ])('should tell %j by its type from what names nothing', (read, unread) => {
    expect(
      match(read)
        .with({ type: P.union(...UNREAD_TYPES) }, () => true)
        .with({ type: 'notFound' }, () => false)
        .exhaustive(),
    ).toBe(unread)
  })
})

describe('refusedValuesOf', () => {
  it('should name every value the problem names, with the rule it broke', () => {
    expect(
      refusedValuesOf({
        errors: [
          {
            field: 'email',
            rule: 'unique',
            message: 'Taken',
            value: null,
            constraint: null,
          },
          {
            field: 'phone',
            rule: 'format',
            message: 'Invalid',
            value: null,
            constraint: null,
          },
        ],
      }),
    ).toEqual([
      { field: 'email', rule: 'unique' },
      { field: 'phone', rule: 'format' },
    ])
  })

  it('should name nothing for a problem without values', () => {
    expect(refusedValuesOf({ errors: null })).toEqual([])
  })
})

describe('whyUnread', () => {
  it('should be too many requests when one of the things that were read says so', () => {
    expect(
      whyUnread([
        { type: 'found' },
        { type: 'failed' },
        { type: 'tooManyRequests' },
      ]),
    ).toEqual(TOO_MANY_REQUESTS)
  })

  it.each<[string, ({ type: string } | undefined)[]]>([
    ['one of them failed', [{ type: 'found' }, { type: 'failed' }]],
    ['one of them names nothing', [{ type: 'notFound' }, { type: 'found' }]],
    ['one of them is still being read', [undefined, { type: 'failed' }]],
    ['there is nothing to go by', []],
  ])('should be a failure when %s', (_, reads) => {
    expect(whyUnread(reads)).toEqual(FAILED)
  })
})

describe('pageOf', () => {
  it('should be the items with what the API said of the list', () => {
    expect(pageOf(['a', 'b'], { total: 5, nextCursor: 'b' })).toEqual({
      type: 'found',
      items: ['a', 'b'],
      total: 5,
      nextCursor: 'b',
    })
  })
})

describe('from', () => {
  it('should leave the cursor out for the first page', () => {
    expect(from(undefined)).toEqual({})
  })

  it('should begin after the item the cursor names', () => {
    expect(from('b')).toEqual({ cursor: 'b' })
  })
})

describe('toTheEnd', () => {
  const pages: Record<string, Page<string>> = {
    first: pageOf(['a', 'b'], { total: 5, nextCursor: 'b' }),
    b: pageOf(['c', 'd'], { total: 5, nextCursor: 'd' }),
    d: pageOf(['e'], { total: 5, nextCursor: null }),
  }

  it('should put the items of every page together, in their order', async () => {
    // Arrange
    const readPage = vi.fn(
      async (cursor: string | undefined): Promise<Page<string>> =>
        pages[cursor ?? 'first'] ?? pageOf([], { total: 0, nextCursor: null }),
    )

    // Act
    const read = await toTheEnd(readPage)

    // Assert
    expect(read).toEqual({ type: 'found', items: ['a', 'b', 'c', 'd', 'e'] })
    expect(readPage.mock.calls).toEqual([[undefined], ['b'], ['d']])
  })

  it('should stop at a page that was not read: half a list is not the list', async () => {
    // Arrange
    const readPage = async (
      cursor: string | undefined,
    ): Promise<Page<string> | Unread> =>
      cursor === undefined ? (pages['first'] ?? FAILED) : TOO_MANY_REQUESTS

    // Act
    const read = await toTheEnd(readPage)

    // Assert
    expect(read).toEqual(TOO_MANY_REQUESTS)
  })

  it('should read no more than ten pages', async () => {
    // Arrange: a list that never ends
    const readPage = vi.fn(
      async (cursor: string | undefined): Promise<Page<string>> =>
        pageOf([cursor ?? 'start'], {
          total: null,
          nextCursor: `${cursor ?? ''}+`,
        }),
    )

    // Act
    const read = await toTheEnd(readPage)

    // Assert
    expect(readPage).toHaveBeenCalledTimes(10)
    expect(read).toMatchObject({ type: 'found' })
  })

  it('should ask for pages as large as the API gives', () => {
    expect(LARGEST_PAGE).toBe(100)
  })
})

describe('unreadMessageOf', () => {
  it('should ask for patience when there were too many requests', () => {
    expect(unreadMessageOf('メニュー', TOO_MANY_REQUESTS)).toBe(
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    )
  })

  const NOT_READ: [string, Unread | NotFound][] = [
    ['a failure', FAILED],
    ['a part of a salon that the API does not find', { type: 'notFound' }],
  ]

  it.each(NOT_READ)(
    'should name what could not be read after %s',
    (_, reason) => {
      expect(unreadMessageOf('メニュー', reason)).toBe(
        'メニューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
    },
  )
})

describe('unsentMessageOf', () => {
  it('should ask for patience when there were too many requests', () => {
    expect(unsentMessageOf(TOO_MANY_REQUESTS)).toBe(
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    )
  })

  it('should say that nothing was sent, and to look at the connection', () => {
    expect(unsentMessageOf(FAILED)).toBe(
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })
})

describe('the parts of the patterns of an operation that needs no session', () => {
  it.each<[string, PublicAnswer, string | Unread | NotFound]>([
    ['what was asked for', { status: 200, data: 'read' }, 'read'],
    ['nothing at the address', problem(404), NOT_FOUND],
    ['a value the screens should not have sent', problem(400), FAILED],
    ['too many requests', problem(429), TOO_MANY_REQUESTS],
    ['a failure of the API', problem(500), FAILED],
    ['no answer', null, FAILED],
  ])('should read %s', (_, answer, read) => {
    expect(readPublic(answer)).toEqual(read)
  })

  it('should leave a 400 to the match with the answers that say nothing', () => {
    expect(readPublicWithUnanswered(problem(400))).toBe('refused')
    expect(readPublicWithUnanswered(null)).toEqual(FAILED)
    expect(readPublicWithUnanswered(problem(429))).toEqual(TOO_MANY_REQUESTS)
    expect(readPublicWithUnanswered(problem(500))).toEqual(FAILED)
  })
})
