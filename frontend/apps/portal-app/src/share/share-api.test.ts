import {
  answering,
  empty,
  OUTSIDE_THE_CONTRACT,
  pageOfAGateway,
  problem,
  record,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { consent, photo } from './components/examples'
import { loadSharedFile, readSharedFile } from './share-api'

/*
 * What the API and the storage answer to a share link is met with the real
 * API and a real storage (`share.integration.test.tsx`). Here are the
 * answers a test cannot bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

const TOKEN = 'Q3xY0T0kZXlqV2V3d3Z0aWtGbVhfX2xPbV9vX19uMDA'
const STORAGE = 'https://storage.salon.example'
const DOWNLOAD_URL = `${STORAGE}/attachments-of-a-salon/attachments/1?X-Amz-Signature=abc`

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The methods, the addresses and the bodies of the requests that were sent */
const askedOf = (fetched: ReturnType<typeof answering>) =>
  Promise.all(
    fetched.mock.calls.map(async ([asked, init]) => {
      const request = new Request(asked, init)
      const url = new URL(request.url)
      const body = await request.text()

      return [
        request.method,
        url.origin === STORAGE ? `${url.origin}${url.pathname}` : url.pathname,
        body === '' ? body : JSON.parse(body),
      ]
    }),
  )

const UNREAD: [string, Answer, string][] = [
  ['too many requests', () => problem(429), 'tooManyRequests'],
  ['an error of the server', () => problem(500), 'failed'],
  ['a body too large', () => problem(413), 'failed'],
  ['a body of another kind', () => problem(415), 'failed'],
  [
    'no answer',
    () => Promise.reject(new TypeError('Failed to fetch')),
    'failed',
  ],
  ...OUTSIDE_THE_CONTRACT.map(([name, status]): [string, Answer, string] => [
    name,
    () => pageOfAGateway(status),
    'failed',
  ]),
]

describe('readSharedFile', () => {
  it.each<[string, string | null]>([
    ['without a password, for a link that may have none', null],
    ['with the password that was typed', 'umi no mieru heya'],
  ])(
    'should ask for the file of the token in the body, %s',
    async (_, password) => {
      // Arrange
      const fetched = answering(() => record(200, photo))

      // Act
      const read = await readSharedFile(TOKEN, password)

      // Assert
      expect(read).toEqual({ type: 'found', file: photo })
      expect(await askedOf(fetched)).toEqual([
        ['POST', '/api/v1/share/file', { token: TOKEN, password }],
      ])
    },
  )

  it.each<[string, Answer, string]>([
    [
      'a password that is not the one, or a locked link',
      () => problem(403),
      'passwordRefused',
    ],
    [
      'a password longer than that of any link',
      () => problem(400, [{ field: 'password', rule: 'too_big' }]),
      'passwordRefused',
    ],
    [
      'a token of no link, or of one that works no more',
      () => problem(404),
      'unusable',
    ],
    ...UNREAD,
  ])('should read no file after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readSharedFile(TOKEN, 'umi no mieru heya')

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('loadSharedFile', () => {
  /** Answers the URL of the download, and the storage at it */
  const answeringLoad = (answers: { issue?: Answer; fetch?: Answer }) =>
    answering((request) => {
      const url = new URL(request.url)
      if (url.origin === STORAGE) {
        return (answers.fetch ?? (() => new Response(PNG, { status: 200 })))()
      }
      return (
        answers.issue ??
        (() =>
          record(200, {
            downloadUrl: DOWNLOAD_URL,
            expiresAt: '2026-11-21T03:05:00.000Z',
          }))
      )()
    })

  it('should ask for the URL once, fetch the file from the storage without the API, and hold it as the kind the API named', async () => {
    // Arrange
    const fetched = answeringLoad({
      fetch: () =>
        new Response(PNG, {
          status: 200,
          headers: { 'Content-Type': 'binary/octet-stream' },
        }),
    })

    // Act
    const load = await loadSharedFile(TOKEN, 'umi no mieru heya', photo)

    // Assert
    expect(load.type).toBe('loaded')
    const content = load.type === 'loaded' ? load.content : new Blob()
    expect(content.type).toBe('image/png')
    expect(new Uint8Array(await content.arrayBuffer())).toEqual(PNG)
    expect(await askedOf(fetched)).toEqual([
      [
        'POST',
        '/api/v1/share/download-url',
        { token: TOKEN, password: 'umi no mieru heya', inline: false },
      ],
      ['GET', `${STORAGE}/attachments-of-a-salon/attachments/1`, ''],
    ])
    const [, toStorage] = fetched.mock.calls[1] ?? []
    expect(toStorage).toBeUndefined()
  })

  it('should send no password for a link that has none', async () => {
    // Arrange
    const fetched = answeringLoad({})

    // Act
    await loadSharedFile(TOKEN, null, consent)

    // Assert
    expect(await askedOf(fetched)).toContainEqual([
      'POST',
      '/api/v1/share/download-url',
      { token: TOKEN, password: null, inline: false },
    ])
  })

  it.each<[string, Answer, string]>([
    [
      'a password the API refuses now, as a link locked meanwhile',
      () => problem(403),
      'passwordRefused',
    ],
    [
      'a link that works no more: expired, used up or revoked meanwhile',
      () => problem(404),
      'unusable',
    ],
    ...UNREAD,
  ])(
    'should fetch nothing from the storage after %s, when the URL is asked for',
    async (_, issue, type) => {
      // Arrange
      const fetched = answeringLoad({ issue })

      // Act
      const load = await loadSharedFile(TOKEN, null, photo)

      // Assert
      expect(load).toEqual({ type })
      expect(fetched).toHaveBeenCalledOnce()
    },
  )

  it.each<[string, Answer]>([
    ['a file it does not have', () => empty(404)],
    ['a signature that expired', () => empty(403)],
    ['no answer', () => Promise.reject(new TypeError('Failed to fetch'))],
    [
      'a file it could not send to its end',
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new TypeError('network error'))
            },
          }),
          { status: 200 },
        ),
    ],
  ])(
    'should say that the file was not fetched after the storage answered %s',
    async (_, fetch) => {
      // Arrange
      const fetched = answeringLoad({ fetch })

      // Act
      const load = await loadSharedFile(TOKEN, null, photo)

      // Assert
      expect(load).toEqual({ type: 'notFetched' })
      expect(fetched).toHaveBeenCalledTimes(2)
    },
  )
})
