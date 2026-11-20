import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the charts arrange in the database, and read
 * back from it. The seed data has charts for Tanaka Yuki (with allergies)
 * and Sato Sakura (without); Yamamoto Kenji and the VIP customer have
 * none.
 */

const storedSchema = z.array(
  z.object({
    previousTreatments: z.array(
      z.object({
        treatment: z.string(),
        date: z.string(),
        salonName: z.string().nullable(),
        notes: z.string().nullable(),
      }),
    ),
    medicalConditions: z.string().nullable(),
    preferredProducts: z.array(z.string()),
    avoidProducts: z.array(z.string()),
    notes: z.string().nullable(),
  }),
)

/** The chart the database keeps of a customer, by their address of mail; none when they have none. */
export const storedChartOf = async (email: string) =>
  storedSchema.parse(
    await testApi().query(
      `select charts."previousTreatments", charts."medicalConditions",
              charts."preferredProducts", charts."avoidProducts", charts.notes
       from medical_charts charts join customers on customers.id = charts."customerId"
       where customers.email = $1`,
      [email],
    ),
  )[0]

/** Lets another account have written what to take care of meanwhile. */
export const conditionsWrittenMeanwhile = (
  email: string,
  medicalConditions: string,
): Promise<unknown> =>
  testApi().query(
    `update medical_charts set "medicalConditions" = $2, "updatedAt" = now()
     where "customerId" = (select id from customers where email = $1)`,
    [email, medicalConditions],
  )

/** Lets another account have made the chart of a customer meanwhile. */
export const chartMadeMeanwhile = (
  email: string,
  medicalConditions: string,
): Promise<unknown> =>
  testApi().query(
    `insert into medical_charts ("customerId", "previousTreatments", "medicalConditions", "preferredProducts", "avoidProducts")
     select id, '[]'::jsonb, $2, '{}', '{}' from customers where email = $1`,
    [email, medicalConditions],
  )

/** Lets every customer with the tag have a chart, each made a minute before the one after it. */
export const chartsOfTagged = (tag: string): Promise<unknown> =>
  testApi().query(
    `insert into medical_charts ("customerId", "previousTreatments", "preferredProducts", "avoidProducts", "createdAt", "updatedAt")
     select id, '[]'::jsonb, '{}', '{}',
            now() - make_interval(mins => row_number() over (order by email)::int),
            now() - make_interval(mins => row_number() over (order by email)::int)
     from customers where $1 = any(tags)`,
    [tag],
  )
