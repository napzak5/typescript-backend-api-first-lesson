import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the products arrange in the database, and read
 * back from it. The salon in Tokyo of the seed data has seven products,
 * all carried; the six of them other than the wax are in stock. The salon
 * in Osaka has two.
 */

const storedSchema = z.array(
  z.object({
    productCode: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    category: z.string().nullable(),
    brand: z.string().nullable(),
    purchasePrice: z.number().nullable(),
    retailPrice: z.number().nullable(),
    salonPrice: z.number().nullable(),
    unit: z.string(),
    minimumStock: z.string(),
    reorderPoint: z.string().nullable(),
    maximumStock: z.string().nullable(),
    supplier: z.string().nullable(),
    supplierProductCode: z.string().nullable(),
    leadTimeDays: z.number().nullable(),
    imageUrl: z.string().nullable(),
    barcode: z.string().nullable(),
    isForSale: z.boolean(),
    isForTreatment: z.boolean(),
    requiresLotTracking: z.boolean(),
    expiryMonths: z.number().nullable(),
    storageConditions: z.string().nullable(),
    safetyDataSheet: z.string().nullable(),
    isActive: z.boolean(),
    updatedAt: z.string(),
  }),
)

/** The products of a salon as the database keeps them, those removed left out, in the order of their codes. */
export const storedProductsOf = async (salon: string) =>
  storedSchema.parse(
    await testApi().query(
      `select p."productCode", p.name, p.description, p.category, p.brand,
              p."purchasePrice", p."retailPrice", p."salonPrice", p.unit,
              p."minimumStock"::text, p."reorderPoint"::text, p."maximumStock"::text,
              p.supplier, p."supplierProductCode", p."leadTimeDays", p."imageUrl",
              p.barcode, p."isForSale", p."isForTreatment", p."requiresLotTracking",
              p."expiryMonths", p."storageConditions", p."safetyDataSheet",
              p."isActive", p."updatedAt"::text
       from products p join salons s on s.id = p."salonId"
       where s.name = $1 and p."deletedAt" is null
       order by p."productCode", p.id`,
      [salon],
    ),
  )

const idsSchema = z.tuple([z.object({ id: z.uuid() })])

/** The ID of a product of a salon that was not removed, by its code. */
export const productIdOf = async (
  salon: string,
  productCode: string,
): Promise<string> =>
  idsSchema.parse(
    await testApi().query(
      `select p.id::text from products p join salons s on s.id = p."salonId"
       where s.name = $1 and p."productCode" = $2 and p."deletedAt" is null`,
      [salon, productCode],
    ),
  )[0].id

const removedSchema = z.array(z.object({ removed: z.boolean() }))

/** Whether each product of a salon of the code was removed, oldest first. */
export const removalsOf = async (
  salon: string,
  productCode: string,
): Promise<boolean[]> =>
  removedSchema
    .parse(
      await testApi().query(
        `select p."deletedAt" is not null as removed
         from products p join salons s on s.id = p."salonId"
         where s.name = $1 and p."productCode" = $2
         order by p."createdAt", p.id`,
        [salon, productCode],
      ),
    )
    .map(({ removed }) => removed)

/**
 * Lets the salon have more products than a page of the ledger holds: as
 * many cotton pads, of the codes 「PAD01」 on, as `count`.
 */
export const padsOf = async (salon: string, count: number): Promise<void> => {
  await testApi().query(
    `insert into products ("salonId", "productCode", name, unit, "isForSale", "isForTreatment")
     select s.id, 'PAD' || lpad(n::text, 2, '0'), 'Cotton Pad ' || n, 'pack', false, true
     from salons s, generate_series(1, $2::int) n
     where s.name = $1`,
    [salon, count],
  )
}

/** Lets somebody else have changed the reorder point of a product meanwhile. */
export const reorderPointChangedMeanwhile = async (
  salon: string,
  productCode: string,
  level: number,
): Promise<void> => {
  await testApi().query(
    `update products p set "reorderPoint" = $3, "updatedAt" = now()
     from salons s
     where s.id = p."salonId" and s.name = $1 and p."productCode" = $2`,
    [salon, productCode, level],
  )
}

/** Lets somebody else have stopped carrying a product meanwhile. */
export const droppedMeanwhile = async (
  salon: string,
  productCode: string,
): Promise<void> => {
  await testApi().query(
    `update products p set "isActive" = false, "updatedAt" = now()
     from salons s
     where s.id = p."salonId" and s.name = $1 and p."productCode" = $2`,
    [salon, productCode],
  )
}

/** Lets somebody else have removed a product meanwhile, as the API removes it. */
export const removedMeanwhile = async (
  salon: string,
  productCode: string,
): Promise<void> => {
  await testApi().query(
    `update products p set "deletedAt" = now(), "updatedAt" = now()
     from salons s
     where s.id = p."salonId" and s.name = $1 and p."productCode" = $2`,
    [salon, productCode],
  )
}
