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

const namedSchema = z.tuple([z.object({ displayName: z.string() })])

/** The name the salon shows of the member of the staff an account of the seed data is. */
export const displayNameOf = async (email: string): Promise<string> =>
  namedSchema.parse(
    await testApi().query(
      `select s."displayName" from staff s join users u on u.id = s."userId"
       where u.email = $1`,
      [email],
    ),
  )[0].displayName

const movementsSchema = z.array(
  z.object({
    transactionType: z.string(),
    quantity: z.string(),
    balanceAfter: z.string(),
    unitCost: z.number().nullable(),
    totalCost: z.number().nullable(),
    reason: z.string().nullable(),
    performedBy: z.string().nullable(),
  }),
)

/** The movements of a row as the database keeps them, the latest first. */
export const storedMovementsOf = async (inventoryId: string) =>
  movementsSchema.parse(
    await testApi().query(
      `select "transactionType"::text, quantity::text, "balanceAfter"::text,
              "unitCost", "totalCost", reason, "performedBy"::text
       from inventory_transactions
       where "inventoryId" = $1
       order by "createdAt" desc, id desc`,
      [inventoryId],
    ),
  )

/** A movement that was recorded earlier, as the arrangement gives it */
type Earlier = {
  transactionType: string
  quantity: number
  /** When it was recorded: a moment of UTC */
  createdAt: string
  reason?: string
  referenceType?: string
}

/**
 * Lets movements of a row have been recorded earlier, one after the other
 * from the 20 the seed began the row with. The row keeps its stock: the
 * history is all a test of it reads.
 */
export const recordedEarlier = async (
  inventoryId: string,
  movements: readonly Earlier[],
): Promise<void> => {
  // Each movement begins from the 20 of the seed and what the ones before it moved
  const befores = movements.map((_, index) =>
    movements
      .slice(0, index)
      .reduce((balance, { quantity }) => balance + quantity, 20),
  )
  await Promise.all(
    movements.map((movement, index) =>
      testApi().query(
        `insert into inventory_transactions
           ("salonId", "productId", "inventoryId", "transactionType", quantity,
            "balanceBefore", "balanceAfter", reason, "referenceType", "referenceId",
            "lotNumber", "expiryDate", "createdAt")
         select i."salonId", i."productId", i.id, $2::inventory_transaction_type, $3,
                $4::numeric, $4::numeric + $3::numeric, $5, $6::varchar,
                case when $6::varchar is null then null else gen_random_uuid() end,
                i."lotNumber", i."expiryDate", $7
         from inventory i where i.id = $1`,
        [
          inventoryId,
          movement.transactionType,
          movement.quantity,
          befores[index] ?? 20,
          movement.reason ?? null,
          movement.referenceType ?? null,
          movement.createdAt,
        ],
      ),
    ),
  )
}

/** Lets some of the stock of a row have been reserved meanwhile. */
export const reservedMeanwhile = async (
  inventoryId: string,
  reserved: number,
): Promise<void> => {
  await testApi().query(
    `update inventory set "reservedStock" = $2,
       "availableStock" = "currentStock" - $2::numeric, "updatedAt" = now()
     where id = $1`,
    [inventoryId, reserved],
  )
}

const countsSchema = z.array(
  z.object({
    productCode: z.string(),
    currentStock: z.string(),
    availableStock: z.string(),
    counted: z.boolean(),
    countedBy: z.string().nullable(),
  }),
)

/**
 * The stock of the rows of a salon as the database keeps them, in the
 * order of the codes of their products, with whether they were counted and
 * the name of the member of the staff who counted them last.
 */
export const countsOf = async (salon: string) =>
  countsSchema.parse(
    await testApi().query(
      `select p."productCode", i."currentStock"::text,
              i."availableStock"::text, i."lastCountedAt" is not null as counted,
              st."displayName" as "countedBy"
       from inventory i
         join products p on p.id = i."productId"
         join salons s on s.id = i."salonId"
         left join staff st on st.id = i."lastCountedBy"
       where s.name = $1
       order by p."productCode", i."lotNumber" nulls first, i.id`,
      [salon],
    ),
  )
