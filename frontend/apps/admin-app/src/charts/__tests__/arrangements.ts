import { idOf, testApi } from '@beauty-salon-frontend/testing/api'
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

const storedAllergiesSchema = z.array(
  z.object({
    allergyType: z.string(),
    allergenName: z.string(),
    severityType: z.string(),
    symptoms: z.string().nullable(),
    notes: z.string().nullable(),
    confirmedDate: z.string().nullable(),
  }),
)

/**
 * The allergies the database keeps of a customer, by their address of mail,
 * in the order they were recorded: those of the seed data, recorded at once,
 * by their allergen.
 */
export const storedAllergiesOf = async (email: string) =>
  storedAllergiesSchema.parse(
    await testApi().query(
      `select allergies."allergyType", allergies."allergenName", allergies."severityType",
              allergies.symptoms, allergies.notes, allergies."confirmedDate"::text as "confirmedDate"
       from customer_allergies allergies join customers on customers.id = allergies."customerId"
       where customers.email = $1
       order by allergies."createdAt", allergies."allergenName" collate "C"`,
      [email],
    ),
  )

/** The ID of the allergy of a customer with the allergen. */
export const allergyIdOf = (
  email: string,
  allergenName: string,
): Promise<string> =>
  idOf(
    `select allergies.id::text from customer_allergies allergies
     join customers on customers.id = allergies."customerId"
     where customers.email = $1 and allergies."allergenName" = $2`,
    [email, allergenName],
  )

/** Lets another account have written the symptoms of an allergy meanwhile. */
export const symptomsWrittenMeanwhile = (
  email: string,
  allergenName: string,
  symptoms: string,
): Promise<unknown> =>
  testApi().query(
    `update customer_allergies set symptoms = $3, "updatedAt" = now()
     where "customerId" = (select id from customers where email = $1)
       and "allergenName" = $2`,
    [email, allergenName, symptoms],
  )

/** Lets another account have removed an allergy meanwhile. */
export const allergyRemovedMeanwhile = (
  email: string,
  allergenName: string,
): Promise<unknown> =>
  testApi().query(
    `delete from customer_allergies
     where "customerId" = (select id from customers where email = $1)
       and "allergenName" = $2`,
    [email, allergenName],
  )

/** Lets a customer have as many mild allergies, named 「アレルゲン 01」 on, each recorded a minute before the one after it. */
export const mildAllergiesOf = (
  email: string,
  count: number,
): Promise<unknown> =>
  testApi().query(
    `insert into customer_allergies ("customerId", "allergyType", "allergenName", "severityType", "createdAt", "updatedAt")
     select customers.id, 'other', 'アレルゲン ' || lpad(n::text, 2, '0'), 'mild',
            now() - make_interval(mins => $2 - n), now() - make_interval(mins => $2 - n)
     from customers, generate_series(1, $2::int) as n
     where customers.email = $1`,
    [email, count],
  )
