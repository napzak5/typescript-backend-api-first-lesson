import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the stock arrange in the database, and read
 * back from it. The salon in Tokyo of the seed data keeps a row of each of
 * six products, all but the wax: 20 of each, of a lot of its own, which
 * expired on 31 December 2025, in Storage Room A. Every product of the
 * seed but the wax is kept by lots. The salon in Osaka keeps no stock.
 */

const storedSchema = z.array(
  z.object({
    productCode: z.string(),
    currentStock: z.string(),
    lotNumber: z.string().nullable(),
    expiryDate: z.string().nullable(),
    location: z.string().nullable(),
    shelf: z.string().nullable(),
    notes: z.string().nullable(),
  }),
)

/** The stock rows of a salon as the database keeps them, in the order of the codes of their products and their lots. */
export const storedRowsOf = async (salon: string) =>
  storedSchema.parse(
    await testApi().query(
      `select p."productCode", i."currentStock"::text, i."lotNumber",
              i."expiryDate"::text, i.location, i.shelf, i.notes
       from inventory i
         join products p on p.id = i."productId"
         join salons s on s.id = i."salonId"
       where s.name = $1
       order by p."productCode", i."lotNumber" nulls first, i.id`,
      [salon],
    ),
  )

const idsSchema = z.tuple([z.object({ id: z.uuid() })])

/** The ID of the only stock row of a product of a salon, or of the row of its lot. */
export const rowIdOf = async (
  salon: string,
  productCode: string,
  lotNumber?: string,
): Promise<string> =>
  idsSchema.parse(
    await testApi().query(
      `select i.id::text from inventory i
         join products p on p.id = i."productId"
         join salons s on s.id = i."salonId"
       where s.name = $1 and p."productCode" = $2
         and ($3::text is null or i."lotNumber" = $3)`,
      [salon, productCode, lotNumber ?? null],
    ),
  )[0].id

const drawnSchema = z.array(
  z.object({ lotNumber: z.string().nullable(), shelf: z.string().nullable() }),
)

/**
 * The lot and the shelf of each stock row of a salon, in the order of the
 * codes of their products: the seed draws them at random.
 */
export const drawnOf = async (salon: string) =>
  drawnSchema.parse(
    await testApi().query(
      `select i."lotNumber", i.shelf from inventory i
         join products p on p.id = i."productId"
         join salons s on s.id = i."salonId"
       where s.name = $1
       order by p."productCode", i."lotNumber" nulls first, i.id`,
      [salon],
    ),
  )

/**
 * Lets a salon keep another row of a product: of a lot, or without one, of
 * the stock given, as the API would have added it and the stock been
 * moved meanwhile.
 */
export const anotherRow = async ({
  salon,
  productCode,
  lotNumber,
  stock = 0,
  expiryDate = null,
}: {
  salon: string
  productCode: string
  lotNumber: string | null
  stock?: number
  expiryDate?: string | null
}): Promise<string> =>
  idsSchema.parse(
    await testApi().query(
      `insert into inventory ("salonId", "productId", "currentStock", "availableStock", "lotNumber", "expiryDate")
       select s.id, p.id, $4, $4, $3, $5::date
       from products p join salons s on s.id = p."salonId"
       where s.name = $1 and p."productCode" = $2
       returning id::text`,
      [salon, productCode, lotNumber, stock, expiryDate],
    ),
  )[0].id

/** Lets the rows of a product of a salon expire on a day; `null` for none. */
export const expiringOn = async (
  salon: string,
  productCode: string,
  day: string | null,
): Promise<void> => {
  await testApi().query(
    `update inventory i set "expiryDate" = $3::date, "updatedAt" = now()
     from products p, salons s
     where p.id = i."productId" and s.id = i."salonId"
       and s.name = $1 and p."productCode" = $2`,
    [salon, productCode, day],
  )
}

/** Lets a product be kept at a minimum stock, which the stock of the seed meets. */
export const minimumOf = async (
  salon: string,
  productCode: string,
  minimum: number,
): Promise<void> => {
  await testApi().query(
    `update products p set "minimumStock" = $3, "updatedAt" = now()
     from salons s
     where s.id = p."salonId" and s.name = $1 and p."productCode" = $2`,
    [salon, productCode, minimum],
  )
}

/** Lets somebody else have marked a product as kept by lots, or not, meanwhile. */
export const lotsKeptMeanwhile = async (
  salon: string,
  productCode: string,
  kept: boolean,
): Promise<void> => {
  await testApi().query(
    `update products p set "requiresLotTracking" = $3, "updatedAt" = now()
     from salons s
     where s.id = p."salonId" and s.name = $1 and p."productCode" = $2`,
    [salon, productCode, kept],
  )
}

/** Lets somebody else have removed a stock row meanwhile, as the API removes it. */
export const rowRemovedMeanwhile = async (
  inventoryId: string,
): Promise<void> => {
  await testApi().query('delete from inventory where id = $1', [inventoryId])
}

/**
 * Lets the salon keep more rows than a page holds: a product of the codes
 * 「PAD01」 on, as many as `count`, each with a row of no stock.
 */
export const padRowsOf = async (
  salon: string,
  count: number,
): Promise<void> => {
  await testApi().query(
    `with added as (
       insert into products ("salonId", "productCode", name, unit, "isForSale", "isForTreatment")
       select s.id, 'PAD' || lpad(n::text, 2, '0'), 'Cotton Pad ' || n, 'pack', false, true
       from salons s, generate_series(1, $2::int) n
       where s.name = $1
       returning id, "salonId"
     )
     insert into inventory ("salonId", "productId", "currentStock", "availableStock")
     select "salonId", id, 0, 0 from added`,
    [salon, count],
  )
}
