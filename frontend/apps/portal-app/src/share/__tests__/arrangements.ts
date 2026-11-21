import { testApi } from '@beauty-salon-frontend/testing/api'
import { expect } from 'vitest'
import * as z from 'zod'
import { accessTokenOf, TOKYO } from '../../bookings/__tests__/arrangements'

/*
 * What the screen tests of the share links arrange, as the salon in Tokyo
 * does through the API, and read back from the database. The seed data has
 * no file and no share link: a test uploads its file to the storage of the
 * test server, or puts one into the database that the storage does not
 * have, and shares it.
 */

const OWNER = 'owner@beautysalon.jp'

/** The bytes of a PNG image: its signature, and the start of its header */
export const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
])

/** The bytes of a PDF: its header, and an end */
export const PDF_TEXT =
  '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'

/** A password a share link takes */
export const PASSWORD = 'umi no mieru heya'

const idsSchema = z.tuple([z.object({ id: z.uuid() })])

const tokyoId = async (): Promise<string> =>
  idsSchema.parse(
    await testApi().query('select id::text from salons where name = $1', [
      TOKYO,
    ]),
  )[0].id

/** Asks the API as the owner of the salon in Tokyo, as a client that is no screen does. */
const asOwner = async (
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> =>
  fetch(`${testApi().origin}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessTokenOf(OWNER)}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const issuedSchema = z.object({
  data: z.object({
    attachment: z.object({ id: z.uuid() }),
    uploadUrl: z.string(),
    uploadHeaders: z.record(z.string(), z.string()),
  }),
})

/**
 * A file of the salon in Tokyo that its owner uploaded, as the screen of
 * the files does: the URL is asked for, the bytes are sent to the storage
 * of the test server, and the upload is finished.
 */
export const uploadFile = async ({
  filename,
  contentType,
  bytes,
}: {
  filename: string
  contentType: string
  bytes: Uint8Array<ArrayBuffer>
}): Promise<string> => {
  const issued = await asOwner('POST', '/attachments/upload-url', {
    filename,
    contentType,
    size: bytes.byteLength,
    salonId: await tokyoId(),
  })
  expect(issued.status).toBe(201)
  const { attachment, uploadUrl, uploadHeaders } = issuedSchema.parse(
    await issued.json(),
  ).data
  const stored = await fetch(uploadUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body: bytes,
  })
  expect(stored.ok).toBe(true)
  const completed = await asOwner(
    'POST',
    `/attachments/${attachment.id}/complete`,
  )
  expect(completed.status).toBe(200)

  return attachment.id
}

/** A file of the salon in Tokyo that the database has and the storage does not */
export const fileNotStored = async (filename: string): Promise<string> =>
  idsSchema.parse(
    await testApi().query(
      `insert into attachments
         ("salonId", filename, "contentType", size, status, "uploadedBy",
          "uploadExpiresAt", "uploadedAt")
       select $1, $2, 'image/png', 24, 'uploaded', u.id,
         now() + interval '15 minutes', now()
       from users u where u.email = $3
       returning id::text`,
      [await tokyoId(), filename, OWNER],
    ),
  )[0].id

const sharedSchema = z.object({
  data: z.object({
    shareLink: z.object({ id: z.uuid() }),
    token: z.string(),
  }),
})

/** Shares a file as the owner does, for a day: the ID of the link, and its token. */
export const share = async (
  attachmentId: string,
  {
    maxDownloads = null,
    password = null,
  }: { maxDownloads?: number | null; password?: string | null } = {},
): Promise<{ id: string; token: string }> => {
  const answer = await asOwner(
    'POST',
    `/attachments/${attachmentId}/share-links`,
    {
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxDownloads,
      password,
    },
  )
  expect(answer.status).toBe(201)
  const { shareLink, token } = sharedSchema.parse(await answer.json()).data

  return { id: shareLink.id, token }
}

/** Revokes a share link, as the owner does meanwhile. */
export const revoke = async (shareLinkId: string): Promise<void> => {
  const answer = await asOwner(
    'DELETE',
    `/attachments/share-links/${shareLinkId}`,
  )
  expect(answer.status).toBe(204)
}

const shareLinkSchema = z.tuple([
  z.object({ downloadCount: z.number(), failedAttempts: z.number() }),
])

/** How often a link gave its file, and how many passwords in a row were not its own */
export const countsOf = async (shareLinkId: string) =>
  shareLinkSchema.parse(
    await testApi().query(
      'select "downloadCount", "failedAttempts" from share_links where id = $1',
      [shareLinkId],
    ),
  )[0]

/** What a link may have become while nobody looked: what the API does not tell apart */
export const BECOMINGS: [
  string,
  (link: string, file: string) => Promise<unknown>,
][] = [
  ['revoked', (link) => revoke(link)],
  [
    'expired',
    (link) =>
      testApi().query(
        `update share_links set "createdAt" = now() - interval '2 hours',
           "expiresAt" = now() - interval '1 minute' where id = $1`,
        [link],
      ),
  ],
  [
    'used as often as it may',
    (link) =>
      testApi().query(
        `update share_links set "maxDownloads" = 2, "downloadCount" = 2 where id = $1`,
        [link],
      ),
  ],
  [
    'of a file that was removed',
    (_, file) =>
      testApi().query(
        'update attachments set "deletedAt" = now() where id = $1',
        [file],
      ),
  ],
]

/** Locks a link, as five passwords in a row that were not its own do. */
export const lock = (shareLinkId: string) =>
  testApi().query(
    `update share_links set "failedAttempts" = 5,
       "lockedUntil" = now() + interval '15 minutes' where id = $1`,
    [shareLinkId],
  )
