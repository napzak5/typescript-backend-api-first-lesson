import {
  answering,
  asked,
  empty,
  page,
  problem,
  record,
  sent,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../../bookings/components/examples'
import { FILES_OF_THE_SALON, photo } from '../components/examples'
import {
  attachmentKeyOf,
  attachmentsKeyOf,
  readAttachment,
  readAttachmentPage,
  readDownloadUrl,
  removeAttachment,
  uploadAttachment,
} from './attachments-api'

/*
 * What the API and the storage answer to the files is met with the real
 * API and a real storage (`attachments.integration.test.tsx`). Here are the
 * answers a test cannot bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
})

const STORAGE = 'https://storage.salon.example'
const UPLOAD_URL = `${STORAGE}/attachments-of-a-salon/attachments/${photo.id}?X-Amz-Signature=abc`

const pending = { ...photo, status: 'pending', uploadedAt: null }

/** The answer to the request of the URL of an upload */
const issued = (): Response =>
  record(201, {
    attachment: pending,
    uploadUrl: UPLOAD_URL,
    uploadHeaders: { 'Content-Type': 'image/jpeg', 'If-None-Match': '*' },
  })

const completed = (): Response => record(200, photo)

const stored = (): Response => empty(200)

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
    const fetched = answering(() => page(FILES_OF_THE_SALON, 'next', 23))

    // Act
    const read = await readAttachmentPage(salon.id, 'cursor')

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: FILES_OF_THE_SALON,
      total: 23,
      nextCursor: 'next',
    })
    expect(asked(fetched)).toEqual([
      `GET /attachments?cursor=cursor&limit=20&salonId=${salon.id}`,
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
    const read = await readAttachmentPage(salon.id, undefined)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readAttachment', () => {
  it('should ask for the file by its ID', async () => {
    // Arrange
    const fetched = answering(() => record(200, photo))

    // Act
    const read = await readAttachment(photo.id)

    // Assert
    expect(read).toEqual({ type: 'found', attachment: photo })
    expect(asked(fetched)).toEqual([`GET /attachments/${photo.id}`])
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
  ])('should ask for the URL that %s', async (_, inline, written) => {
    // Arrange
    const fetched = answering(() =>
      record(200, {
        downloadUrl: `${STORAGE}/file`,
        expiresAt: '2026-11-21T03:05:00.000Z',
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
    expect(asked(fetched)).toEqual([
      `GET /attachments/${photo.id}/download-url?inline=${written}`,
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
    expect(asked(fetched)).toEqual([
      'POST /attachments/upload-url',
      `PUT ${UPLOAD_URL}`,
      `POST /attachments/${photo.id}/complete`,
    ])
    expect(await sent(fetched)).toEqual([
      {
        filename: '施術前.jpg',
        contentType: 'image/jpeg',
        size: 6,
        salonId: salon.id,
      },
      [...new Uint8Array(BYTES)],
    ])
    const [, toStorage] = fetched.mock.calls[1] ?? []
    const headers = new Headers(toStorage?.headers)
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
    ['a signature it refused', () => empty(403)],
    ['a file it holds already', () => empty(412)],
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
    const fetched = answering(() => empty(204))

    // Act
    const removal = await removeAttachment(photo.id)

    // Assert
    expect(removal).toEqual({ type: 'removed' })
    expect(asked(fetched)).toEqual([`DELETE /attachments/${photo.id}`])
    expect(await sent(fetched)).toEqual([])
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
