import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the reviews arrange in the database, and read
 * back from it. The salon in Tokyo of the seed data has three reviews,
 * written at the same moment: «Excellent service!» of 5 by Tanaka Yuki,
 * which the salon answered and three customers found helpful, with a
 * report the platform dismissed; «Satisfied with the result» of 4, which
 * one found helpful; and «Good but could be better» of 3 by Sato Sakura,
 * of Yui Watanabe, which nobody did. The salon in Osaka has two, one of
 * them («Great experience») with a report that waits.
 */

const idsSchema = z.tuple([z.object({ id: z.uuid() })])

/** The ID of a review, by its title */
export const reviewIdOf = async (title: string): Promise<string> =>
  idsSchema.parse(
    await testApi().query('select id::text from reviews where title = $1', [
      title,
    ]),
  )[0].id

const storedSchema = z.tuple([
  z.object({
    ownerResponse: z.string().nullable(),
    ownerRespondedAt: z.string().nullable(),
    reportCount: z.number(),
  }),
])

/** What the database keeps of the answer to a review, and how many of its reports wait */
export const storedReviewOf = async (title: string) =>
  storedSchema.parse(
    await testApi().query(
      `select "ownerResponse", "ownerRespondedAt"::text, "reportCount"
       from reviews where title = $1`,
      [title],
    ),
  )[0]

const reportsSchema = z.array(
  z.object({
    reason: z.string(),
    details: z.string().nullable(),
    status: z.string(),
    reportedBy: z.string(),
  }),
)

/** The reports of a review as the database keeps them, the first first, with the address of the account that made each */
export const storedReportsOf = async (title: string) =>
  reportsSchema.parse(
    await testApi().query(
      `select rr.reason::text, rr.details, rr.status::text, u.email as "reportedBy"
       from review_reports rr
         join reviews r on r.id = rr."reviewId"
         join users u on u.id = rr."reportedBy"
       where r.title = $1
       order by rr."createdAt", rr.id`,
      [title],
    ),
  )

/** Removes a review, as its customer does meanwhile. */
export const reviewRemovedMeanwhile = async (title: string): Promise<void> => {
  await testApi().query('delete from reviews where title = $1', [title])
}
