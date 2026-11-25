import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { DomainError } from '@beauty-salon-backend/domain'
import {
  startTestStorage,
  type TestStorage,
} from '@beauty-salon-backend/testing'
import type { Result } from '@beauty-salon-backend/utility'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { S3FileStorage, type S3Settings } from '../s3-file-storage'

/**
 * The files go to a real S3-compatible storage: the storage of the tests
 * (`startTestStorage`), SeaweedFS in a container of its own, which is told
 * its bucket and its one identity when it starts.
 *
 * Another storage is tested instead when `TEST_STORAGE_ENDPOINT` names
 * one, with `TEST_STORAGE_REGION`, `TEST_STORAGE_BUCKET`,
 * `TEST_STORAGE_ACCESS_KEY_ID` and `TEST_STORAGE_SECRET_ACCESS_KEY`: that
 * is how the storage of an environment is checked before the server uses
 * it. What the tests store there is under a prefix of their own and
 * removed at the end.
 */

const SECOND = 1000

const external = process.env['TEST_STORAGE_ENDPOINT']

/** The storage of the tests, when no other storage is named. */
let started: TestStorage | undefined
let settings: S3Settings = {
  endpoint: external ?? '',
  publicEndpoint: external ?? '',
  region: process.env['TEST_STORAGE_REGION'] ?? 'us-east-1',
  bucket: process.env['TEST_STORAGE_BUCKET'] ?? 'attachments-of-the-tests',
  accessKeyId: process.env['TEST_STORAGE_ACCESS_KEY_ID'] ?? 'test-access-key',
  secretAccessKey:
    process.env['TEST_STORAGE_SECRET_ACCESS_KEY'] ??
    'secret-of-the-storage-tests-31337',
}
let storage: S3FileStorage
/** The storage as the tests reach it themselves, around what is tested. */
let direct: S3Client

/** Everything the tests store is under this, and removed at the end. */
const PREFIX = `attachments-of-the-tests/${randomUUID()}`
const keys: string[] = []

/** A key nothing is stored under yet. */
const newKey = (): string => {
  const key = `${PREFIX}/${randomUUID()}`
  keys.push(key)
  return key
}

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const directClient = (): S3Client =>
  new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

beforeAll(async () => {
  if (external === undefined) {
    started = await startTestStorage(settings)
    settings = {
      ...settings,
      endpoint: started.endpoint,
      publicEndpoint: started.endpoint,
    }
  }
  storage = new S3FileStorage(settings)
  direct = directClient()
})

afterAll(async () => {
  for (const key of keys) {
    await direct?.send(
      new DeleteObjectCommand({ Bucket: settings.bucket, Key: key }),
    )
  }
  storage?.close()
  direct?.destroy()
  await started?.stop()
})

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** A file of the size given that begins as a PNG image does. */
const pngOf = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size).fill(7)
  bytes.set(PNG.slice(0, size))
  return bytes
}

const dataOf = <T>(result: Result<T, DomainError>): T => {
  if (result.type === 'error') {
    throw new Error(`Expected a success, got ${JSON.stringify(result.error)}`)
  }
  return result.data
}

const minutesFromNow = (minutes: number): Date =>
  new Date(Date.now() + minutes * 60 * SECOND)

/** A URL that takes a PNG image of the size given under a new key. */
const uploadOf = async (size: number, expiresAt = minutesFromNow(15)) => {
  const key = newKey()
  const ticket = dataOf(
    await storage.issueUpload(
      { key, contentType: 'image/png', size },
      expiresAt,
    ),
  )
  return { key, ...ticket }
}

/** Sends a body to an upload URL as a client does; answers the status. */
const put = async (
  url: string,
  headers: Record<string, string>,
  body: Uint8Array,
): Promise<number> => {
  const response = await fetch(url, { method: 'PUT', headers, body })
  await response.arrayBuffer()
  return response.status
}

/** A PNG image of the size given, uploaded by a URL of its own; its key. */
const uploaded = async (size: number): Promise<string> => {
  const { key, url, headers } = await uploadOf(size)
  expect(await put(url, headers, pngOf(size))).toBe(200)
  return key
}

/** A file stored around the URLs, as the tests reach the storage themselves. */
const storedDirectly = async (body: Uint8Array): Promise<string> => {
  const key = newKey()
  await direct.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/octet-stream',
    }),
  )
  return key
}

describe('S3FileStorage', () => {
  describe('issueUpload', () => {
    it('signs a URL at the public endpoint for the key, the type, the length and for an upload that overwrites nothing', async () => {
      const { key, url, headers } = await uploadOf(64)

      const signed = new URL(url)
      expect(signed.origin).toBe(settings.publicEndpoint)
      expect(signed.pathname).toBe(`/${settings.bucket}/${key}`)
      expect(signed.searchParams.get('X-Amz-SignedHeaders')).toBe(
        'content-length;content-type;host;if-none-match',
      )
      expect(signed.searchParams.get('X-Amz-Algorithm')).toBe(
        'AWS4-HMAC-SHA256',
      )
      expect(signed.searchParams.get('X-Amz-Credential')).toContain(
        settings.accessKeyId,
      )
      // What the client sends the URL with. The length is the body's.
      expect(headers).toEqual({
        'Content-Type': 'image/png',
        'If-None-Match': '*',
      })
      // No checksum of a body that is not there yet.
      expect(
        [...signed.searchParams.keys()].filter((name) =>
          name.toLowerCase().includes('checksum'),
        ),
      ).toEqual([])
      expect(url).not.toContain(settings.secretAccessKey)
    })

    it('takes the file that was announced, once', async () => {
      const { key, url, headers } = await uploadOf(64)

      expect(await put(url, headers, pngOf(64))).toBe(200)

      expect(dataOf(await storage.inspect(key, 12))).toEqual({
        size: 64,
        head: pngOf(12),
      })
      // Nothing is overwritten: the URL has taken its one upload.
      const other = new Uint8Array(64).fill(1)
      expect(await put(url, headers, other)).toBe(412)
      expect(dataOf(await storage.inspect(key, 12))?.head).toEqual(pngOf(12))
    })

    it.each([
      ['another type', { 'Content-Type': 'text/html' }, 64],
      ['no type', { 'Content-Type': '' }, 64],
      ['a longer body', {}, 65],
      ['a shorter body', {}, 63],
      ['an empty body', {}, 0],
      ['an upload that may overwrite', { 'If-None-Match': '' }, 64],
    ])('refuses %s, and stores nothing', async (_case, changed, size) => {
      const { key, url, headers } = await uploadOf(64)
      const sent = Object.fromEntries(
        Object.entries({ ...headers, ...changed }).filter(
          ([, value]) => value !== '',
        ),
      )

      const status = await put(url, sent, pngOf(size))

      expect(status).toBe(403)
      expect(dataOf(await storage.inspect(key, 12))).toBeNull()
    })

    it('refuses a URL whose key, expiry or signature was changed', async () => {
      const { key, url, headers } = await uploadOf(64)
      const elsewhere = url.replace(key, `${key}-other`)
      const longer = url.replace(/X-Amz-Expires=\d+/, 'X-Amz-Expires=604800')
      const unsigned = url.split('?')[0] ?? ''

      expect(await put(elsewhere, headers, pngOf(64))).toBe(403)
      expect(await put(longer, headers, pngOf(64))).toBe(403)
      expect(await put(unsigned, headers, pngOf(64))).toBe(403)
      expect(dataOf(await storage.inspect(key, 12))).toBeNull()
      keys.push(`${key}-other`)
    })

    it('takes another upload by the same URL once the file is removed', async () => {
      const { key, url, headers } = await uploadOf(64)
      expect(await put(url, headers, pngOf(64))).toBe(200)

      dataOf(await storage.remove(key))
      const again = await put(url, headers, new Uint8Array(64).fill(1))

      expect(again).toBe(200)
      expect(dataOf(await storage.inspect(key, 4))?.head).toEqual(
        new Uint8Array(4).fill(1),
      )
    })

    it('signs for as long as until the moment given: never shorter, and less than a second longer', async () => {
      const expiresAt = new Date(Date.now() + 15 * 60 * SECOND + 250)

      const { url } = await uploadOf(64, expiresAt)

      const signed = new URL(url).searchParams
      const stamp = signed.get('X-Amz-Date') ?? ''
      const from = Date.parse(
        `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13)}`,
      )
      const until = from + Number(signed.get('X-Amz-Expires')) * SECOND
      expect(until).toBeGreaterThanOrEqual(expiresAt.getTime())
      expect(until - expiresAt.getTime()).toBeLessThan(SECOND)
    })

    it('refuses an upload once the URL has run out', async () => {
      const { key, url, headers } = await uploadOf(
        64,
        new Date(Date.now() + SECOND),
      )

      await pause(3 * SECOND)
      const status = await put(url, headers, pngOf(64))

      expect(status).toBe(403)
      expect(dataOf(await storage.inspect(key, 12))).toBeNull()
    })

    it('signs a URL of a second for a moment that has passed', async () => {
      const { url } = await uploadOf(64, new Date(Date.now() - 60 * SECOND))

      expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe('1')
    })

    it('takes a file of 10 MiB', async () => {
      const size = 10 * 1024 * 1024
      const { key, url, headers } = await uploadOf(size)

      expect(await put(url, headers, pngOf(size))).toBe(200)

      expect(dataOf(await storage.inspect(key, 12))).toEqual({
        size,
        head: pngOf(12),
      })
    })
  })

  describe('inspect', () => {
    it('answers null for a key nothing is stored under', async () => {
      expect(dataOf(await storage.inspect(newKey(), 12))).toBeNull()
    })

    it('answers the size of the whole file and no more of it than was asked for', async () => {
      const key = await uploaded(100_000)

      expect(dataOf(await storage.inspect(key, 12))).toEqual({
        size: 100_000,
        head: pngOf(12),
      })
      expect(dataOf(await storage.inspect(key, 1))).toEqual({
        size: 100_000,
        head: pngOf(1),
      })
    })

    it('answers all of a file that is shorter than what was asked for', async () => {
      const key = await uploaded(5)

      expect(dataOf(await storage.inspect(key, 12))).toEqual({
        size: 5,
        head: pngOf(5),
      })
    })

    it('answers a file of exactly as many bytes as were asked for', async () => {
      const key = await uploaded(12)

      expect(dataOf(await storage.inspect(key, 12))).toEqual({
        size: 12,
        head: pngOf(12),
      })
    })

    it('answers an empty file as one of no bytes, which no URL of an upload takes', async () => {
      const key = await storedDirectly(new Uint8Array())

      expect(dataOf(await storage.inspect(key, 12))).toEqual({
        size: 0,
        head: new Uint8Array(),
      })
    })
  })

  describe('issueDownload', () => {
    const DISPOSITION = `attachment; filename="___.png"; filename*=UTF-8''%E6%96%BD%E8%A1%93%E5%89%8D.png`

    const downloadOf = async (
      key: string,
      expiresAt = minutesFromNow(5),
      contentDisposition = DISPOSITION,
    ): Promise<string> =>
      dataOf(
        await storage.issueDownload(
          { key, contentType: 'image/png', contentDisposition },
          expiresAt,
        ),
      )

    it('signs a URL at the public endpoint that answers the file as the type and under the name given', async () => {
      const key = await storedDirectly(pngOf(64))

      const url = await downloadOf(key)
      const response = await fetch(url)

      expect(new URL(url).origin).toBe(settings.publicEndpoint)
      expect(new URL(url).pathname).toBe(`/${settings.bucket}/${key}`)
      expect(url).not.toContain(settings.secretAccessKey)
      expect(response.status).toBe(200)
      // Not the type the file was stored with.
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('content-disposition')).toBe(DISPOSITION)
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngOf(64))
    })

    it('answers the file shown in the browser when the name is given so', async () => {
      const key = await uploaded(64)

      const url = await downloadOf(
        key,
        minutesFromNow(5),
        `inline; filename="a.png"; filename*=UTF-8''a.png`,
      )
      const response = await fetch(url)
      await response.arrayBuffer()

      expect(response.headers.get('content-disposition')).toBe(
        `inline; filename="a.png"; filename*=UTF-8''a.png`,
      )
    })

    it('refuses a URL whose name, type, key or signature was changed, and other methods', async () => {
      const key = await uploaded(64)
      const url = await downloadOf(key)
      const statusOf = async (changed: string, method = 'GET') => {
        const response = await fetch(changed, { method })
        await response.arrayBuffer()
        return response.status
      }

      expect(await statusOf(url.replace('attachment', 'inline'))).toBe(403)
      expect(await statusOf(url.replace('image%2Fpng', 'text%2Fhtml'))).toBe(
        403,
      )
      expect(await statusOf(url.replace(key, `${key}-other`))).toBe(403)
      expect(await statusOf(url.split('?')[0] ?? '')).toBe(403)
      expect(await statusOf(url, 'DELETE')).toBe(403)
      expect(await statusOf(url, 'PUT')).toBe(403)
      expect(await statusOf(url)).toBe(200)
    })

    it('answers nothing once the URL has run out', async () => {
      const key = await uploaded(64)
      const url = await downloadOf(key, new Date(Date.now() + SECOND))

      await pause(3 * SECOND)
      const response = await fetch(url)
      await response.arrayBuffer()

      expect(response.status).toBe(403)
    })

    it('answers 404 by a URL of a file that has been removed', async () => {
      const key = await uploaded(64)
      const url = await downloadOf(key)

      dataOf(await storage.remove(key))
      const response = await fetch(url)
      await response.arrayBuffer()

      expect(response.status).toBe(404)
    })
  })

  describe('remove', () => {
    it('removes the file, and succeeds again when nothing is stored', async () => {
      const key = await uploaded(64)

      expect(await storage.remove(key)).toEqual({ type: 'success', data: null })
      expect(dataOf(await storage.inspect(key, 12))).toBeNull()
      expect(await storage.remove(key)).toEqual({ type: 'success', data: null })
      expect(await storage.remove(newKey())).toEqual({
        type: 'success',
        data: null,
      })
    })

    it('removes no other file', async () => {
      const key = await uploaded(64)
      const other = await uploaded(64)

      dataOf(await storage.remove(key))

      expect(dataOf(await storage.inspect(other, 12))?.size).toBe(64)
    })
  })

  describe('a public endpoint of its own', () => {
    it('signs the URLs for the host a client reaches, and reaches the storage itself by the other', async () => {
      const behindAName = new S3FileStorage({
        ...settings,
        publicEndpoint: 'https://files.salon.example',
      })
      const key = await uploaded(64)

      const upload = dataOf(
        await behindAName.issueUpload(
          { key: newKey(), contentType: 'image/png', size: 64 },
          minutesFromNow(15),
        ),
      )
      const download = dataOf(
        await behindAName.issueDownload(
          { key, contentType: 'image/png', contentDisposition: 'inline' },
          minutesFromNow(5),
        ),
      )
      const inspected = await behindAName.inspect(key, 12)
      behindAName.close()

      expect(new URL(upload.url).origin).toBe('https://files.salon.example')
      expect(new URL(download).origin).toBe('https://files.salon.example')
      expect(new URL(upload.url).searchParams.get('X-Amz-SignedHeaders')).toBe(
        'content-length;content-type;host;if-none-match',
      )
      expect(dataOf(inspected)?.size).toBe(64)
    })
  })

  describe('a storage that refuses or cannot be reached', () => {
    const failureOf = (result: Result<unknown, DomainError>) =>
      result.type === 'error' ? result.error : null

    it('answers what the storage refused as a storage error, without the secret or a signature', async () => {
      const key = await uploaded(64)
      const stranger = new S3FileStorage({
        ...settings,
        secretAccessKey: 'not-the-secret-of-the-storage-31338',
      })

      const inspected = await stranger.inspect(key, 12)
      const removed = await stranger.remove(key)
      stranger.close()

      expect(failureOf(inspected)).toEqual({
        type: 'storage',
        message: 'Failed to read the stored file',
        cause: {
          name: expect.any(String),
          message: expect.any(String),
          status: 403,
        },
      })
      expect(failureOf(removed)).toMatchObject({
        type: 'storage',
        message: 'Failed to remove the stored file',
        cause: { status: 403 },
      })
      expect(JSON.stringify([inspected, removed])).not.toContain('31338')
      expect(JSON.stringify([inspected, removed])).not.toContain(
        'X-Amz-Signature',
      )
      // The file is still there.
      expect(dataOf(await storage.inspect(key, 12))?.size).toBe(64)
    })

    it('answers a bucket that is not there as a storage error, not as a file that is not stored', async () => {
      const misnamed = new S3FileStorage({
        ...settings,
        bucket: 'no-bucket-of-this-name',
      })

      const inspected = await misnamed.inspect(newKey(), 12)
      misnamed.close()

      expect(failureOf(inspected)).toMatchObject({
        type: 'storage',
        message: 'Failed to read the stored file',
      })
    })

    it('answers a storage nothing listens at as a storage error, and still signs URLs, which takes no storage', async () => {
      const unreachable = new S3FileStorage({
        ...settings,
        endpoint: 'http://127.0.0.1:1',
      })

      const inspected = await unreachable.inspect(newKey(), 12)
      const removed = await unreachable.remove(newKey())
      const upload = await unreachable.issueUpload(
        { key: newKey(), contentType: 'image/png', size: 64 },
        minutesFromNow(15),
      )
      const download = await unreachable.issueDownload(
        {
          key: newKey(),
          contentType: 'image/png',
          contentDisposition: 'inline',
        },
        minutesFromNow(5),
      )
      unreachable.close()

      expect(failureOf(inspected)).toMatchObject({
        type: 'storage',
        message: 'Failed to read the stored file',
        cause: { status: null },
      })
      expect(failureOf(removed)).toMatchObject({
        type: 'storage',
        message: 'Failed to remove the stored file',
      })
      expect(upload.type).toBe('success')
      expect(download.type).toBe('success')
    })
  })
})
