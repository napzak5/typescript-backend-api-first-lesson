import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { salon } from '../bookings/components/examples'
import {
  attachmentKeyOf,
  attachmentsKeyOf,
  readAttachment,
  readAttachmentPage,
  readDownloadUrl,
  removeAttachment,
  uploadAttachment,
} from './attachments-api'
import { FILES_OF_THE_SALON, photo } from './components/examples'

/*
 * What the API and the storage answer to the files is met with the real
 * API and a real storage (`attachments.integration.test.tsx`). Here are the
 * answers a test cannot bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The methods, the addresses, the queries and the bodies of the requests that were sent */
const askedOf = (fetched: ReturnType<typeof answering>) =>
  Promise.all(
    fetched.mock.calls.map(async ([asked, init]) => {
      const request = new Request(asked, init)
      const url = new URL(request.url)
      const body = await request.text()

      return [
        request.method,
        `${url.origin === 'https://storage.salon.example' ? url.origin : ''}${url.pathname}`,
        Object.fromEntries(url.searchParams),
        body === '' || request.method === 'PUT' ? body : JSON.parse(body),
      ]
    }),
  )

const STORAGE = 'https://storage.salon.example'
const UPLOAD_URL = `${STORAGE}/attachments-of-a-salon/attachments/${photo.id}?X-Amz-Signature=abc`

const pending = { ...photo, status: 'pending', uploadedAt: null }

/** The answer to the request of the URL of an upload */
const issued = (): Response =>
  json(201, {
    data: {
      attachment: pending,
      uploadUrl: UPLOAD_URL,
      uploadHeaders: { 'Content-Type': 'image/jpeg', 'If-None-Match': '*' },
    },
    meta: null,
    links: null,
  })

const completed = (): Response =>
  json(200, { data: photo, meta: null, links: null })

const stored = (): Response => new Response(null, { status: 200 })

const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).buffer

/** The file of the tests: a JPEG image of six bytes */
const upload = (file = new File([BYTES], '施術前.jpg')) =>
  uploadAttachment(salon.id, { file, contentType: 'image/jpeg' })

/** Answers the three requests of an upload in turn: the URL, the storage and the completion */
const answeringUpload = (answers: {
  issue?: Answer
  store?: Answer
  complete?: Answer
}) =>
  answering((request) => {
    if (request.url.startsWith(STORAGE)) {
      return (answers.store ?? stored)()
    }
    return request.url.endsWith('/complete')
      ? (answers.complete ?? completed)()
      : (answers.issue ?? issued)()
  })

describe('attachmentsKeyOf and attachmentKeyOf', () => {
  it('should list the files below the salon, and read a file by its ID in small letters', () => {
    expect(attachmentsKeyOf(salon.id)).toEqual([
      'salons',
      salon.id,
      'attachments',
    ])
    expect(attachmentKeyOf(photo.id.toUpperCase())).toEqual([
      'attachment',
      photo.id,
    ])
  })
})

describe('readAttachmentPage', () => {
  it('should ask for a page of twenty files of the salon after the cursor', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: FILES_OF_THE_SALON,
        meta: { total: 23, nextCursor: 'next', prevCursor: null },
        links: null,
      }),
    )

    // Act
    const page = await readAttachmentPage(salon.id, 'cursor')

    // Assert
    expect(page).toEqual({
      type: 'found',
      items: FILES_OF_THE_SALON,
      total: 23,
      nextCursor: 'next',
    })
    expect(await askedOf(fetched)).toEqual([
      [
        'GET',
        '/api/v1/attachments',
        { salonId: salon.id, cursor: 'cursor', limit: '20' },
        '',
      ],
    ])
  })

  it.each<[string, Answer, string]>([
    ['an account of another salon', () => problem(403), 'forbidden'],
    ['a cursor of a file removed meanwhile', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should read no page after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const page = await readAttachmentPage(salon.id, undefined)

    // Assert
    expect(page).toEqual({ type })
  })
})

describe('readAttachment', () => {
  it('should ask for the file by its ID', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: photo, meta: null, links: null }),
    )

    // Act
    const read = await readAttachment(photo.id)

    // Assert
    expect(read).toEqual({ type: 'found', attachment: photo })
    expect(await askedOf(fetched)).toEqual([
      ['GET', `/api/v1/attachments/${photo.id}`, {}, ''],
    ])
  })

  it.each<[string, Answer, string]>([
    [
      'a file that is none, removed or of another salon',
      () => problem(404),
      'notFound',
    ],
    ['an ID that is none', () => problem(400), 'notFound'],
    ['an account of no salon', () => problem(403), 'failed'],
    ...UNREAD,
  ])('should read no file after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readAttachment(photo.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readDownloadUrl', () => {
  it.each<[string, boolean, string]>([
    ['shows the file in the browser', true, 'true'],
    ['saves the file under its name', false, 'false'],
  ])('should ask for the URL that %s', async (_, inline, asked) => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: {
          downloadUrl: `${STORAGE}/file`,
          expiresAt: '2026-11-21T03:05:00.000Z',
        },
        meta: null,
        links: null,
      }),
    )

    // Act
    const read = await readDownloadUrl(photo.id, inline)

    // Assert
    expect(read).toEqual({
      type: 'issued',
      url: `${STORAGE}/file`,
      expiresAt: '2026-11-21T03:05:00.000Z',
    })
    expect(await askedOf(fetched)).toEqual([
      [
        'GET',
        `/api/v1/attachments/${photo.id}/download-url`,
        { inline: asked },
        '',
      ],
    ])
  })

  it.each<[string, Answer, string]>([
    ['a file removed meanwhile', () => problem(404), 'notFound'],
    ['a file whose upload was not finished', () => problem(409), 'failed'],
    ['an account of no salon', () => problem(403), 'failed'],
    ...UNREAD,
  ])('should give no URL after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readDownloadUrl(photo.id, true)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('uploadAttachment', () => {
  it('should ask for the URL, send the file to the storage with the signed headers, and finish the upload', async () => {
    // Arrange
    const fetched = answeringUpload({})

    // Act
    const uploading = await upload()

    // Assert
    expect(uploading).toEqual({ type: 'uploaded', attachment: photo })
    expect(await askedOf(fetched)).toEqual([
      [
        'POST',
        '/api/v1/attachments/upload-url',
        {},
        {
          filename: '施術前.jpg',
          contentType: 'image/jpeg',
          size: 6,
          salonId: salon.id,
        },
      ],
      [
        'PUT',
        `${STORAGE}/attachments-of-a-salon/attachments/${photo.id}`,
        { 'X-Amz-Signature': 'abc' },
        new TextDecoder().decode(BYTES),
      ],
      ['POST', `/api/v1/attachments/${photo.id}/complete`, {}, ''],
    ])
    const [, sent] = fetched.mock.calls[1] ?? []
    const headers = new Headers(sent?.headers)
    expect(headers.get('content-type')).toBe('image/jpeg')
    expect(headers.get('if-none-match')).toBe('*')
  })

  it('should ask for nothing when the browser cannot read the file', async () => {
    // Arrange
    const fetched = answeringUpload({})
    const file = new File([BYTES], '施術前.jpg')
    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(
      new DOMException('The file was changed', 'NotReadableError'),
    )

    // Act
    const uploading = await upload(file)

    // Assert
    expect(uploading).toEqual({ type: 'unreadable' })
    expect(fetched).not.toHaveBeenCalled()
  })

  it.each<[string, Answer, unknown]>([
    [
      'a value the API refused',
      () => problem(400, [{ field: 'salonId', rule: 'not_found' }]),
      { type: 'invalid', values: [{ field: 'salonId', rule: 'not_found' }] },
    ],
    ['an account of another salon', () => problem(403), { type: 'forbidden' }],
    ['a body the API does not take', () => problem(413), { type: 'failed' }],
    ...UNREAD.map(([name, answer, type]): [string, Answer, unknown] => [
      name,
      answer,
      { type },
    ]),
  ])(
    'should send nothing to the storage after %s, when the URL is asked for',
    async (_, issue, outcome) => {
      // Arrange
      const fetched = answeringUpload({ issue })

      // Act
      const uploading = await upload()

      // Assert
      expect(uploading).toEqual(outcome)
      expect(fetched).toHaveBeenCalledOnce()
    },
  )

  it.each<[string, Answer]>([
    ['a signature it refused', () => new Response(null, { status: 403 })],
    ['a file it holds already', () => new Response(null, { status: 412 })],
    ['no answer', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])(
    'should not finish an upload that the storage did not take, after %s',
    async (_, store) => {
      // Arrange
      const fetched = answeringUpload({ store })

      // Act
      const uploading = await upload()

      // Assert
      expect(uploading).toEqual({ type: 'notSent' })
      expect(fetched).toHaveBeenCalledTimes(2)
    },
  )

  it.each<[string, Answer, string]>([
    [
      'a file that is not what its type says',
      () => problem(409),
      'notAsDeclared',
    ],
    ['an account of another salon', () => problem(403), 'forbidden'],
    ['a file removed while it was sent', () => problem(404), 'failed'],
    ...UNREAD,
  ])(
    'should say what became of the upload after %s, when it is finished',
    async (_, complete, type) => {
      // Arrange
      answeringUpload({ complete })

      // Act
      const uploading = await upload()

      // Assert
      expect(uploading).toEqual({ type })
    },
  )
})

describe('removeAttachment', () => {
  it('should ask for the removal of the file', async () => {
    // Arrange
    const fetched = answering(() => new Response(null, { status: 204 }))

    // Act
    const removal = await removeAttachment(photo.id)

    // Assert
    expect(removal).toEqual({ type: 'removed' })
    expect(await askedOf(fetched)).toEqual([
      ['DELETE', `/api/v1/attachments/${photo.id}`, {}, ''],
    ])
  })

  it.each<[string, Answer, string]>([
    ['a file removed meanwhile', () => problem(404), 'notFound'],
    ['an ID that is none', () => problem(400), 'notFound'],
    [
      'an account that removes only its own files',
      () => problem(403),
      'forbidden',
    ],
    ...UNREAD,
  ])('should remove nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const removal = await removeAttachment(photo.id)

    // Assert
    expect(removal).toEqual({ type })
  })
})
