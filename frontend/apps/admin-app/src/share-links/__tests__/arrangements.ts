import type { SharedFileCrudGet200 } from '@beauty-salon-frontend/api-client'
import { idOf, testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the share links arrange in the database, and
 * read back from it. The seed data has no file and no share link: a test
 * puts its file into the database (`arrangeFile` of the files), and the
 * links it needs. A link put there has a token nobody knows.
 */

/**
 * Puts a share link of a file into the database, as an account issued it
 * so many hours ago, to end so many hours from now (before now, for one
 * that ran out).
 */
export const arrangeShareLink = async ({
  attachmentId,
  issuedBy,
  hoursAgo = 1,
  hoursLeft = 24,
  maxDownloads = null,
  downloadCount = 0,
  withPassword = false,
}: {
  attachmentId: string
  /** The address of mail of the account that issued it */
  issuedBy: string
  hoursAgo?: number
  hoursLeft?: number
  maxDownloads?: number | null
  downloadCount?: number
  withPassword?: boolean
}): Promise<string> =>
  idOf(
    `insert into share_links
         ("attachmentId", "tokenHash", "passwordHash", "expiresAt",
          "maxDownloads", "downloadCount", "createdBy", "createdAt", "updatedAt")
       select $1, gen_random_uuid()::text,
         case when $7::boolean then 'no password opens this' end,
         now() + $3::float8 * interval '1 hour',
         $4::integer, $5::integer, u.id,
         now() - $2::float8 * interval '1 hour',
         now() - $2::float8 * interval '1 hour'
       from users u where u.email = $6
       returning id::text`,
    [
      attachmentId,
      hoursAgo,
      hoursLeft,
      maxDownloads,
      downloadCount,
      issuedBy,
      withPassword,
    ],
  )

const storedSchema = z.array(
  z.object({
    expiresAt: z.number(),
    maxDownloads: z.number().nullable(),
    downloadCount: z.number(),
    passwordHashed: z.boolean().nullable(),
    issuedBy: z.string(),
  }),
)

/**
 * The links of a file as the database keeps them, the first issued
 * first: the moment each ends at in milliseconds, and whether its
 * password is kept as an Argon2id hash (`null` for one without).
 */
export const storedShareLinksOf = async (attachmentId: string) =>
  storedSchema.parse(
    await testApi().query(
      `select (extract(epoch from s."expiresAt") * 1000)::float8 as "expiresAt",
         s."maxDownloads", s."downloadCount",
         s."passwordHash" like '$argon2id$%' as "passwordHashed",
         u.email as "issuedBy"
       from share_links s join users u on u.id = s."createdBy"
       where s."attachmentId" = $1
       order by s."createdAt", s.id`,
      [attachmentId],
    ),
  )

/** Revokes a link, as another account does meanwhile. */
export const revokedMeanwhile = async (shareLinkId: string): Promise<void> => {
  await testApi().query('delete from share_links where id = $1', [shareLinkId])
}

/** What a test reads of the file of a token: its name */
const sharedFileSchema = z.object({
  data: z.object({ filename: z.string() }),
}) satisfies z.ZodType<{
  data: Pick<SharedFileCrudGet200['data'], 'filename'>
}>

/**
 * What the API tells of the file of a token, as the screen of the portal
 * asks for it: the name of the file, or the status of the refusal.
 */
export const openedWith = async (
  token: string,
  password: string | null,
): Promise<string | number> => {
  const answer = await fetch(`${testApi().origin}/api/v1/share/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })

  return answer.status === 200
    ? sharedFileSchema.parse(await answer.json()).data.filename
    : answer.status
}
