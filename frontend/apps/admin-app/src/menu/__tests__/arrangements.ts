import { idOf, testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the menu arrange in the database, and read back
 * from it. Each salon of the seed data has the same eight categories of the
 * top, Hair Cut to Other Services; the salon in Tokyo has ten services in
 * the first four, the salon in Osaka five, one of them a package of three.
 */

/** A category of a salon of the seed data, by the names of both. */
export const categoryIdOf = async (
  salon: string,
  name: string,
): Promise<string> =>
  idOf(
    `select c.id::text from service_categories c join salons s on s.id = c."salonId"
       where s.name = $1 and c.name = $2`,
    [salon, name],
  )

/** A service of the seed data, by its name. */
export const serviceIdOf = async (name: string): Promise<string> =>
  idOf('select id::text from services where name = $1', [name])

/** Lets a category have been put below another, by their IDs. */
export const putBelow = (id: string, parentId: string): Promise<unknown> =>
  testApi().query(
    `update service_categories set "parentId" = $2,
       "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where id = $1`,
    [id, parentId],
  )

/** Lets a category have been added below another, last in the order. */
export const arrangeChild = async (
  salon: string,
  parent: string,
  name: string,
): Promise<string> =>
  idOf(
    `insert into service_categories ("salonId", name, "parentId", category, "displayOrder", "isActive")
       select p."salonId", $3, p.id, p.category, 20, true
       from service_categories p join salons s on s.id = p."salonId"
       where s.name = $1 and p.name = $2
       returning id::text`,
    [salon, parent, name],
  )

/** Lets somebody else have removed a category meanwhile: its children go to the top, its services to none. */
export const removedMeanwhile = (id: string): Promise<unknown> =>
  testApi().query('delete from service_categories where id = $1', [id])

/** Lets somebody else have described a category meanwhile. */
export const describedMeanwhile = (
  id: string,
  description: string,
): Promise<unknown> =>
  testApi().query(
    `update service_categories set description = $2,
       "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where id = $1`,
    [id, description],
  )

const storedSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string().nullable(),
    parent: z.string().nullable(),
    category: z.string(),
    displayOrder: z.number(),
    iconUrl: z.string().nullable(),
    color: z.string().nullable(),
    isActive: z.boolean(),
    updatedAt: z.string(),
  }),
)

/** The categories of a salon as the database has them, with the names of their parents, by name. */
export const storedCategoriesOf = async (salon: string) =>
  storedSchema.parse(
    await testApi().query(
      `select c.name, c.description, p.name as parent, c.category::text as category,
         c."displayOrder", c."iconUrl", c.color, c."isActive", c."updatedAt"::text as "updatedAt"
       from service_categories c
       join salons s on s.id = c."salonId"
       left join service_categories p on p.id = c."parentId"
       where s.name = $1
       order by c.name`,
      [salon],
    ),
  )

const categorisedSchema = z.array(
  z.object({ name: z.string(), category: z.string().nullable() }),
)

/** The services of the salon in Tokyo with the names of their categories, by name. */
export const storedServicesOf = async (salon: string) =>
  categorisedSchema.parse(
    await testApi().query(
      `select v.name, c.name as category
       from services v
       join salons s on s.id = v."salonId"
       left join service_categories c on c.id = v."categoryId"
       where s.name = $1 and v."deletedAt" is null
       order by v.name`,
      [salon],
    ),
  )

/** Lets somebody else have described a service meanwhile. */
export const serviceDescribedMeanwhile = (
  id: string,
  description: string,
): Promise<unknown> =>
  testApi().query(
    `update services set description = $2,
       "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where id = $1`,
    [id, description],
  )

/** Lets somebody else have removed a service from the menu meanwhile. */
export const serviceRemovedMeanwhile = (id: string): Promise<unknown> =>
  testApi().query(
    `update services set "deletedAt" = now(),
       "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where id = $1`,
    [id],
  )

const serviceStoredSchema = z.array(
  z.object({
    name: z.string(),
    category: z.string().nullable(),
    description: z.string().nullable(),
    duration: z.number(),
    price: z.number(),
    discountPrice: z.number().nullable(),
    taxIncluded: z.boolean(),
    requiredStaffLevel: z.string().nullable(),
    bookingRequirements: z.array(z.string()),
    tags: z.array(z.string()),
    isPackage: z.boolean(),
    packaged: z.array(z.string()),
    options: z.array(
      z.object({
        name: z.string(),
        additionalPrice: z.number(),
        sortOrder: z.number(),
      }),
    ),
    removed: z.boolean(),
  }),
)

/**
 * The services of a salon of a name as the database has them, removed or
 * not: the names of their category and of the services of a package, and
 * their options in their order.
 */
export const storedServicesNamed = async (salon: string, name: string) =>
  serviceStoredSchema.parse(
    await testApi().query(
      `select v.name, c.name as category, v.description, v.duration, v.price, v."discountPrice",
         v."taxIncluded", v."requiredStaffLevel"::text as "requiredStaffLevel",
         v."bookingRequirements"::text[] as "bookingRequirements", v.tags, v."isPackage",
         coalesce((select array_agg(p.name order by array_position(v."packageServiceIds", p.id))
           from services p where p.id = any(v."packageServiceIds")), '{}') as packaged,
         coalesce((select json_agg(json_build_object('name', o.name, 'additionalPrice', o."additionalPrice", 'sortOrder', o."sortOrder")
           order by o."sortOrder", o.id) from service_options o where o."serviceId" = v.id), '[]') as options,
         v."deletedAt" is not null as removed
       from services v
       join salons s on s.id = v."salonId"
       left join service_categories c on c.id = v."categoryId"
       where s.name = $1 and v.name = $2
       order by v."createdAt"`,
      [salon, name],
    ),
  )

const statesSchema = z.array(
  z.object({
    name: z.string(),
    category: z.string().nullable(),
    isActive: z.boolean(),
    serviceStatus: z.string(),
    allowOnlineBooking: z.boolean(),
  }),
)

/** The services of a salon that are in the menu as the database has them, by name: their category and what may be changed of several at once. */
export const storedStatesOf = async (salon: string) =>
  statesSchema.parse(
    await testApi().query(
      `select v.name, c.name as category, v."isActive", v."serviceStatus"::text as "serviceStatus",
         v."allowOnlineBooking"
       from services v
       join salons s on s.id = v."salonId"
       left join service_categories c on c.id = v."categoryId"
       where s.name = $1 and v."deletedAt" is null
       order by v.name`,
      [salon],
    ),
  )
