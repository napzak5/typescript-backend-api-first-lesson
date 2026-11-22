import { countOf, idOf, testApi } from '@beauty-salon-frontend/testing/api'
import { TOKYO } from '@beauty-salon-frontend/testing/seed'
import * as z from 'zod'

/*
 * What the screen tests of the treatment records arrange in the database,
 * and read back from it. The seed data has three records at the salon in
 * Tokyo, one of each visit that took place: Tanaka Yuki (a cut with a
 * treatment, by Hiroshi Tanaka), Sato Sakura (a men's cut without
 * materials, by Yui Watanabe) and Nakamura Hiroshi (a colour with a cut,
 * by Mika Suzuki), written in that order. The lots of the products are
 * numbered at random when the data is seeded.
 */

/** The record of a customer of the seed data, by their address of mail. */
export const treatmentIdOf = async (email: string): Promise<string> =>
  idOf(
    `select records.id::text
       from treatment_records records
       join customers on customers.id = records."customerId"
       where customers.email = $1`,
    [email],
  )

/** The booking of a record of the seed data, by the address of mail of its customer. */
export const treatedBookingOf = async (email: string): Promise<string> =>
  idOf(
    `select records."bookingId"::text as id
       from treatment_records records
       join customers on customers.id = records."customerId"
       where customers.email = $1`,
    [email],
  )

const lotsSchema = z.tuple([z.object({ lotNumber: z.string() })])

/** The lot of a product of the salon in Tokyo that its stock holds, by the code of the product. */
export const lotOf = async (productCode: string): Promise<string> =>
  lotsSchema.parse(
    await testApi().query(
      `select inventory."lotNumber"
       from inventory
       join products on products.id = inventory."productId"
       join salons on salons.id = products."salonId"
       where salons.name = $1 and products."productCode" = $2`,
      [TOKYO, productCode],
    ),
  )[0].lotNumber

const storedSchema = z.array(
  z.object({
    staff: z.string(),
    services: z.array(z.string()),
    techniques: z.array(z.string()),
    consultationNotes: z.string().nullable(),
    scalpCondition: z.string().nullable(),
    hairCondition: z.string().nullable(),
    colorFormula: z.string().nullable(),
    processingTime: z.number().nullable(),
    resultNotes: z.string().nullable(),
    nextRecommendedDate: z.string().nullable(),
    nextRecommendedServices: z.array(z.string()),
    homeCareSuggestions: z.string().nullable(),
    customerSatisfaction: z.number().nullable(),
    staffEvaluation: z.string().nullable(),
    materials: z.array(
      z.object({
        productCode: z.string(),
        quantity: z.string(),
        unit: z.string(),
        lotNumber: z.string().nullable(),
        notes: z.string().nullable(),
      }),
    ),
    updatedAt: z.string(),
  }),
)

/**
 * The record of a booking as it is stored, with the names of its member of
 * the staff and of its services, and its materials in their order; none
 * when the booking has none.
 */
export const storedTreatmentOf = async (bookingId: string) =>
  storedSchema.parse(
    await testApi().query(
      `select staff."displayName" as staff,
              (select coalesce(jsonb_agg(services.name order by listed.place), '[]')
               from jsonb_array_elements_text(records.services) with ordinality as listed(id, place)
               join services on services.id = listed.id::uuid) as services,
              records.techniques, records."consultationNotes", records."scalpCondition",
              records."hairCondition", records."colorFormula", records."processingTime",
              records."resultNotes", to_char(records."nextRecommendedDate", 'YYYY-MM-DD') as "nextRecommendedDate",
              (select coalesce(jsonb_agg(services.name order by listed.place), '[]')
               from jsonb_array_elements_text(records."nextRecommendedServices") with ordinality as listed(id, place)
               join services on services.id = listed.id::uuid) as "nextRecommendedServices",
              records."homeCareSuggestions", records."customerSatisfaction", records."staffEvaluation",
              (select coalesce(jsonb_agg(jsonb_build_object(
                        'productCode', products."productCode", 'quantity', materials.quantity::text,
                        'unit', materials.unit, 'lotNumber', materials."lotNumber", 'notes', materials.notes)
                      order by materials."sortOrder"), '[]')
               from treatment_materials materials
               join products on products.id = materials."productId"
               where materials."treatmentRecordId" = records.id) as materials,
              records."updatedAt"::text as "updatedAt"
       from treatment_records records
       join staff on staff.id = records."staffId"
       where records."bookingId" = $1`,
      [bookingId],
    ),
  )[0]

/** Lets another account have written the record of a booking meanwhile, by the member of the booking. */
export const writtenMeanwhile = async (bookingId: string): Promise<string> =>
  idOf(
    `insert into treatment_records ("bookingId", "customerId", "staffId", services, "resultNotes")
       select bookings.id, bookings."customerId", bookings."staffId",
              (select jsonb_agg(lines."serviceId") from booking_services lines where lines."bookingId" = bookings.id),
              'ほかのアカウントが書いた'
       from bookings where bookings.id = $1
       returning id::text`,
    [bookingId],
  )

/** Lets another account have changed what a record says to hand over meanwhile. */
export const evaluationWrittenMeanwhile = (
  treatmentId: string,
  staffEvaluation: string,
): Promise<unknown> =>
  testApi().query(
    `update treatment_records set "staffEvaluation" = $2, "updatedAt" = now() where id = $1`,
    [treatmentId, staffEvaluation],
  )

/** Lets a record be removed meanwhile, with its materials and photos. */
export const treatmentRemovedMeanwhile = (
  treatmentId: string,
): Promise<unknown> =>
  testApi().query('delete from treatment_records where id = $1', [treatmentId])

/** Lets the treatment of a booking have been called off meanwhile: the booking is cancelled. */
export const bookingCancelledMeanwhile = (
  bookingId: string,
): Promise<unknown> =>
  testApi().query(
    `update bookings set status = 'cancelled', "cancelledAt" = now(), "completedAt" = null,
                         "updatedAt" = now()
     where id = $1`,
    [bookingId],
  )

/** Lets a booking be removed meanwhile, as an owner would have done it. */
export const bookingRemovedMeanwhile = (bookingId: string): Promise<unknown> =>
  testApi().query('delete from bookings where id = $1', [bookingId])

/** Lets the salon in Tokyo remove a product meanwhile, by its code. */
export const productRemovedMeanwhile = (
  productCode: string,
): Promise<unknown> =>
  testApi().query(
    `update products set "deletedAt" = now()
     where "productCode" = $1 and "salonId" = (select id from salons where name = $2)`,
    [productCode, TOKYO],
  )

/**
 * So many records of the bookings the test arranged (`arrangeMany`), one
 * of each, written a minute apart in the order of the bookings: the last
 * booking has the latest record.
 */
export const recordMany = (): Promise<unknown> =>
  testApi().query(
    `insert into treatment_records ("bookingId", "customerId", "staffId", services, "createdAt", "updatedAt")
     select bookings.id, bookings."customerId", bookings."staffId",
            (select jsonb_agg(lines."serviceId") from booking_services lines where lines."bookingId" = bookings.id),
            now() - make_interval(mins => 1000 - row_number() over (order by bookings."bookingNumber")::int),
            now() - make_interval(mins => 1000 - row_number() over (order by bookings."bookingNumber")::int)
     from bookings where bookings."bookingNumber" like 'BK-MANY-%'`,
  )

/** How many records the salons have. */
export const storedTreatmentCount = async (): Promise<number> =>
  countOf('select count(*) as count from treatment_records')

const photosSchema = z.array(
  z.object({
    photoType: z.string(),
    photoUrl: z.string(),
    thumbnailUrl: z.string().nullable(),
    angle: z.string().nullable(),
    description: z.string().nullable(),
    isPublic: z.boolean(),
    customerConsent: z.boolean(),
    sortOrder: z.number(),
  }),
)

/** The photos of a record as they are stored, in their order. */
export const storedPhotosOf = async (treatmentId: string) =>
  photosSchema.parse(
    await testApi().query(
      `select "photoType"::text as "photoType", "photoUrl", "thumbnailUrl", angle, description,
              "isPublic", "customerConsent", "sortOrder"
       from treatment_photos where "treatmentRecordId" = $1
       order by "sortOrder", "createdAt", id`,
      [treatmentId],
    ),
  )

/** Lets another account have added photos to a record meanwhile, at the addresses given, after its photos. */
export const photosAddedMeanwhile = (
  treatmentId: string,
  addresses: readonly string[],
): Promise<unknown> =>
  testApi().query(
    `insert into treatment_photos ("treatmentRecordId", "photoType", "photoUrl", "isPublic",
                                   "customerConsent", "sortOrder")
     select $1, 'other', address, false, false,
            100 + place::int
     from jsonb_array_elements_text($2::jsonb) with ordinality as added(address, place)`,
    [treatmentId, JSON.stringify(addresses)],
  )

/** Lets another account have taken a photo of a record away meanwhile, by its address. */
export const photoRemovedMeanwhile = (photoUrl: string): Promise<unknown> =>
  testApi().query('delete from treatment_photos where "photoUrl" = $1', [
    photoUrl,
  ])
