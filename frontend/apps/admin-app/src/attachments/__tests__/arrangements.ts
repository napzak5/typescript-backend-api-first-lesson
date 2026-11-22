import { idOf, testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the files arrange in the database, and read
 * back from it. The seed data has no file: a test uploads its own through
 * the screen, to the storage of the test server, or puts one into the
 * database, which the storage then does not have.
 */

/**
 * Puts a file whose upload was finished so many minutes ago into the
 * database, as an account uploaded it to a salon.
 */
export const arrangeFile = async ({
  salonId,
  filename,
  contentType = 'application/pdf',
  size = 348_160,
  uploadedBy,
  minutesAgo = 10,
}: {
  salonId: string
  filename: string
  contentType?: string
  size?: number
  /** The address of mail of the account that uploaded it */
  uploadedBy: string
  minutesAgo?: number
}): Promise<string> =>
  idOf(
    `insert into attachments
         ("salonId", filename, "contentType", size, status, "uploadedBy",
          "uploadExpiresAt", "uploadedAt", "createdAt", "updatedAt")
       select $1, $2, $3::attachment_content_type, $4, 'uploaded', u.id,
         now() - ($6 - 15) * interval '1 minute',
         now() - $6 * interval '1 minute',
         now() - ($6 + 1) * interval '1 minute',
         now() - $6 * interval '1 minute'
       from users u where u.email = $5
       returning id::text`,
    [salonId, filename, contentType, size, uploadedBy, minutesAgo],
  )

const storedSchema = z.array(
  z.object({
    filename: z.string(),
    contentType: z.string(),
    size: z.number(),
    status: z.string(),
    uploadedBy: z.string(),
    removed: z.boolean(),
  }),
)

/** The files of a salon as the database keeps them, the first made first, with the address of mail of the account that uploaded each */
export const storedFilesOf = async (salonId: string) =>
  storedSchema.parse(
    await testApi().query(
      `select a.filename, a."contentType"::text, a.size, a.status::text,
         u.email as "uploadedBy", a."deletedAt" is not null as removed
       from attachments a join users u on u.id = a."uploadedBy"
       where a."salonId" = $1
       order by a."createdAt", a.id`,
      [salonId],
    ),
  )

/** Removes a file, as another member of the staff does meanwhile. */
export const fileRemovedMeanwhile = async (id: string): Promise<void> => {
  await testApi().query(
    'update attachments set "deletedAt" = now() where id = $1',
    [id],
  )
}
