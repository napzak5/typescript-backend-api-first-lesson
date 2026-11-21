import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the reports of reviews arrange in the
 * database, and read back from it. In the seed data, «Excellent service!»
 * of the salon in Tokyo has a report as an advertisement that the
 * administrator dismissed, and «Great experience» of the salon in Osaka
 * one as untrue that waits, with details.
 */

const reportsSchema = z.array(
  z.object({
    status: z.string(),
    resolvedBy: z.string().nullable(),
    createdAt: z.string(),
    resolvedAt: z.string().nullable(),
    timezone: z.string(),
  }),
)

/**
 * The reports of a review as the database keeps them, the first first:
 * their state, the address of the account that dismissed each, their
 * moments, and the time zone of the salon of the review, which the
 * screens say the moments in.
 */
export const storedReportStatesOf = async (title: string) =>
  reportsSchema.parse(
    await testApi().query(
      `select rr.status::text, u.email as "resolvedBy",
         to_json(rr."createdAt") #>> '{}' as "createdAt",
         to_json(rr."resolvedAt") #>> '{}' as "resolvedAt",
         s.timezone
       from review_reports rr
         join reviews r on r.id = rr."reviewId"
         join salons s on s.id = r."salonId"
         left join users u on u.id = rr."resolvedBy"
       where r.title = $1
       order by rr."createdAt", rr.id`,
      [title],
    ),
  )

/** Dismisses the reports of a review that wait, as another administrator does meanwhile. */
export const reportsDismissedMeanwhile = async (
  title: string,
  email: string,
): Promise<void> => {
  await testApi().query(
    `update review_reports
     set status = 'dismissed',
       "resolvedBy" = (select id from users where email = $2),
       "resolvedAt" = now()
     where status = 'pending'
       and "reviewId" = (select id from reviews where title = $1)`,
    [title, email],
  )
  await testApi().query(
    `update reviews set "reportCount" = 0 where title = $1`,
    [title],
  )
}

const keptSchema = z.tuple([z.object({ kept: z.number() })])

/** How many reviews of a title the database keeps */
export const reviewsKeptOf = async (title: string): Promise<number> =>
  keptSchema.parse(
    await testApi().query(
      'select count(*)::integer as kept from reviews where title = $1',
      [title],
    ),
  )[0].kept
