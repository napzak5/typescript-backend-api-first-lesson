import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'
import { arrangeFile } from '../../attachments/__tests__/arrangements'

/*
 * What the screen tests of the operations arrange in the database, and
 * read back from it. The seed data has no points with a date of expiry, no
 * deletion request and no attachment.
 */

/**
 * Lets an account have taken the request of a customer to have their data
 * erased fifteen days ago, as the API would have taken it: it is due since
 * yesterday.
 */
export const dueForErasure = (email: string, by: string): Promise<unknown> =>
  testApi().query(
    `insert into customer_deletion_requests ("customerId", reason, "requestedBy", "requestedAt", "scheduledAt")
     select customers.id, 'ご本人からのお申し出', users.id,
            now() - interval '15 days', now() - interval '1 day'
     from customers cross join users
     where customers.email = $1 and customers."deletedAt" is null and users.email = $2`,
    [email, by],
  )

const erasureSchema = z.array(
  z.object({ email: z.string(), removed: z.boolean(), status: z.string() }),
)

/** The address of mail of a customer, whether the ledger removed them, and the state of their requests, as the database keeps them. */
export const storedErasureOf = async (customerId: string) =>
  erasureSchema.parse(
    await testApi().query(
      `select c.email, c."deletedAt" is not null as removed, r.status::text
       from customers c join customer_deletion_requests r on r."customerId" = c.id
       where c.id = $1`,
      [customerId],
    ),
  )

/**
 * Puts a file into the database that an account uploaded to a salon and
 * removed, so many minutes after its address for the upload was given:
 * fifteen minutes after that, the address runs out.
 */
export const arrangeRemovedFile = async (
  salonId: string,
  uploadedBy: string,
  minutesAgo: number,
): Promise<string> => {
  const id = await arrangeFile({
    salonId,
    filename: `削除した書類 ${minutesAgo}.pdf`,
    uploadedBy,
    minutesAgo,
  })
  await testApi().query(
    'update attachments set "deletedAt" = now() where id = $1',
    [id],
  )

  return id
}

const filenamesSchema = z.array(z.object({ filename: z.string() }))

/** The names of the attachments the database keeps, of every salon, deleted or not. */
export const storedFilenames = async (): Promise<string[]> =>
  filenamesSchema
    .parse(
      await testApi().query(
        'select filename from attachments order by filename',
      ),
    )
    .map(({ filename }) => filename)
