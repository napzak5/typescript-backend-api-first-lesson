import type { APIRequestContext } from '@playwright/test'
import * as z from 'zod'
import { salonId } from './bookings'
import { expect, type TestApi } from './fixtures'
import { accessTokenOf, OWNER } from './sign-in'

/*
 * The files of the browser tests, and a file the tests of the share links
 * begin with: the owner of the salon in Tokyo uploads it as the screen of
 * the files does, through the API and the object storage of the test
 * server. The seed data has no file.
 */

/** A PDF of one empty page */
export const PDF = Buffer.from(
  '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
)

/** A PNG image of one pixel */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/** The headers of a request in the name of the owner of the salon in Tokyo */
export const asTheOwner = async (
  request: APIRequestContext,
  api: TestApi,
): Promise<{ Authorization: string }> => ({
  Authorization: `Bearer ${await accessTokenOf(request, api, OWNER)}`,
})

const issuedSchema = z.object({
  data: z.object({
    attachment: z.object({ id: z.string() }),
    uploadUrl: z.string(),
    uploadHeaders: z.record(z.string(), z.string()),
  }),
})

/**
 * A file of the salon in Tokyo that its owner uploads: the URL is asked
 * for, the bytes are sent to the storage, and the upload is finished. The
 * ID of the file.
 */
export const uploadThroughApi = async (
  request: APIRequestContext,
  api: TestApi,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<string> => {
  const headers = await asTheOwner(request, api)
  const issued = await request.post(
    `${api.origin}/api/v1/attachments/upload-url`,
    {
      headers,
      data: {
        filename: file.name,
        contentType: file.mimeType,
        size: file.buffer.length,
        salonId: await salonId(api),
      },
    },
  )
  expect(issued.status()).toBe(201)
  const { attachment, uploadUrl, uploadHeaders } = issuedSchema.parse(
    await issued.json(),
  ).data
  const stored = await request.put(uploadUrl, {
    headers: uploadHeaders,
    data: file.buffer,
  })
  expect(stored.ok()).toBe(true)
  const completed = await request.post(
    `${api.origin}/api/v1/attachments/${attachment.id}/complete`,
    { headers },
  )
  expect(completed.status()).toBe(200)

  return attachment.id
}
