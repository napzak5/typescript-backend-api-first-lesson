import { randomUUID } from 'node:crypto'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import { SALON_KEYS, type SalonKey, type SeededSalons } from './salons'
import type { CategoryKind, SeededCategories } from './service-categories'

/** The lists of a service without images, tags, member services and booking requirements. */
const withoutLists = {
  imageUrls: [],
  tags: [],
  packageServiceIds: [],
  bookingRequirements: [],
}

/** The services of each salon, by name. */
export interface ServiceNames {
  readonly tokyo:
    | 'Ladies Cut'
    | 'Mens Cut'
    | 'Kids Cut (Under 12)'
    | 'Full Color'
    | 'Highlights'
    | 'Balayage'
    | 'Digital Perm'
    | 'Straight Perm'
    | 'Deep Conditioning Treatment'
    | 'Keratin Treatment'
  readonly osaka:
    | 'Head Spa (30 min)'
    | 'Premium Head Spa (60 min)'
    | 'Scalp Treatment'
    | 'Signature Cut'
    | 'Spa & Cut Package'
}

/** A service of the seed, in the category of its kind. */
export type SeededService = Omit<
  typeof schema.services.$inferInsert,
  | 'id'
  | 'salonId'
  | 'categoryId'
  | 'name'
  | 'duration'
  | 'price'
  | 'discountPrice'
  | 'taxIncluded'
  | keyof typeof withoutLists
> & {
  readonly id: string
  readonly category: CategoryKind
  readonly duration: number
  readonly price: number
  readonly discountPrice: number | null
  /** Every price of the seed includes the tax, as a price shown in Japan does. */
  readonly taxIncluded: true
}

export type SeededServices = {
  readonly [S in SalonKey]: { readonly [N in ServiceNames[S]]: SeededService }
}

/** The services that are no package, whose IDs a package names. */
type PlainServices = {
  readonly [S in SalonKey]: {
    readonly [N in Exclude<ServiceNames[S], 'Spa & Cut Package'>]: SeededService
  }
}

const plainServices = (): PlainServices => ({
  tokyo: {
    'Ladies Cut': {
      id: randomUUID(),
      category: 'cut',
      description: 'Professional hair cut for ladies with consultation',
      shortDescription: 'Includes shampoo, cut, and blow dry',
      duration: 60,
      price: 5500,
      discountPrice: null,
      taxIncluded: true,
      requiredStaffLevel: 'stylist',
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 1,
    },
    'Mens Cut': {
      id: randomUUID(),
      category: 'cut',
      description: 'Professional hair cut for men',
      shortDescription: 'Includes shampoo, cut, and styling',
      duration: 45,
      price: 4000,
      discountPrice: null,
      taxIncluded: true,
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 2,
    },
    'Kids Cut (Under 12)': {
      id: randomUUID(),
      category: 'cut',
      description: 'Hair cut for children under 12 years old',
      shortDescription: 'Quick and gentle service for kids',
      duration: 30,
      price: 2500,
      discountPrice: null,
      taxIncluded: true,
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 3,
    },
    'Full Color': {
      id: randomUUID(),
      category: 'color',
      description: 'Complete hair coloring from roots to tips',
      shortDescription: 'Single process color application',
      duration: 120,
      price: 8000,
      discountPrice: 7200,
      taxIncluded: true,
      requiredStaffLevel: 'stylist',
      requiresConsultation: true,
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 4,
    },
    Highlights: {
      id: randomUUID(),
      category: 'color',
      description: 'Professional highlighting with foil technique',
      shortDescription: 'Partial or full head highlights',
      duration: 150,
      price: 12000,
      discountPrice: null,
      taxIncluded: true,
      requiredStaffLevel: 'senior',
      requiresConsultation: true,
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 5,
    },
    Balayage: {
      id: randomUUID(),
      category: 'color',
      description:
        'Hand-painted balayage technique for natural-looking highlights',
      shortDescription: 'Custom balayage coloring',
      duration: 180,
      price: 15000,
      discountPrice: null,
      taxIncluded: true,
      requiredStaffLevel: 'expert',
      requiresConsultation: true,
      allowOnlineBooking: false,
      isActive: true,
      sortOrder: 6,
    },
    'Digital Perm': {
      id: randomUUID(),
      category: 'perm',
      description: 'Modern digital perm for lasting curls',
      shortDescription: 'Heat-activated curling system',
      duration: 180,
      price: 14000,
      discountPrice: null,
      taxIncluded: true,
      requiredStaffLevel: 'senior',
      requiresConsultation: true,
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 7,
    },
    'Straight Perm': {
      id: randomUUID(),
      category: 'perm',
      description: 'Japanese straightening treatment',
      shortDescription: 'Permanent hair straightening',
      duration: 240,
      price: 18000,
      discountPrice: null,
      taxIncluded: true,
      requiredStaffLevel: 'expert',
      requiresConsultation: true,
      allowOnlineBooking: false,
      isActive: true,
      sortOrder: 8,
    },
    'Deep Conditioning Treatment': {
      id: randomUUID(),
      category: 'treatment',
      description: 'Intensive moisture treatment for damaged hair',
      shortDescription: 'Repair and hydrate',
      duration: 30,
      price: 3500,
      discountPrice: null,
      taxIncluded: true,
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 9,
    },
    'Keratin Treatment': {
      id: randomUUID(),
      category: 'treatment',
      description: 'Professional keratin smoothing treatment',
      shortDescription: 'Smooth and strengthen',
      duration: 90,
      price: 8000,
      discountPrice: null,
      taxIncluded: true,
      requiredStaffLevel: 'senior',
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 10,
    },
  },
  osaka: {
    'Head Spa (30 min)': {
      id: randomUUID(),
      category: 'spa',
      description: 'Relaxing head spa with scalp massage',
      shortDescription: 'Stress relief and scalp care',
      duration: 30,
      price: 3000,
      discountPrice: null,
      taxIncluded: true,
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 1,
    },
    'Premium Head Spa (60 min)': {
      id: randomUUID(),
      category: 'spa',
      description: 'Luxury head spa with aromatherapy',
      shortDescription: 'Ultimate relaxation experience',
      duration: 60,
      price: 6000,
      discountPrice: 5400,
      taxIncluded: true,
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 2,
    },
    'Scalp Treatment': {
      id: randomUUID(),
      category: 'spa',
      description: 'Therapeutic scalp treatment for health',
      shortDescription: 'Improve scalp condition',
      duration: 45,
      price: 4500,
      discountPrice: null,
      taxIncluded: true,
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 3,
    },
    'Signature Cut': {
      id: randomUUID(),
      category: 'cut',
      description: 'Our signature cutting technique',
      shortDescription: 'Personalized style consultation',
      duration: 75,
      price: 6500,
      discountPrice: null,
      taxIncluded: true,
      requiredStaffLevel: 'senior',
      allowOnlineBooking: true,
      isActive: true,
      sortOrder: 4,
    },
  },
})

export async function seedServices(
  db: PostgresJsDatabase<typeof schema>,
  salons: SeededSalons,
  categories: SeededCategories,
): Promise<SeededServices> {
  const plain = plainServices()
  const rowOf = (
    salon: SalonKey,
    name: string,
    { category, ...service }: SeededService,
  ): typeof schema.services.$inferInsert => ({
    ...withoutLists,
    ...service,
    salonId: salons[salon].id,
    categoryId: categories[salon][category],
    name,
  })
  await db
    .insert(schema.services)
    .values(
      SALON_KEYS.flatMap((salon) =>
        Object.entries(plain[salon]).map(([name, service]) =>
          rowOf(salon, name, service),
        ),
      ),
    )

  // A package names its member services, so it is stored after them.
  const spaAndCut: SeededService = {
    id: randomUUID(),
    category: 'other',
    description: 'Complete relaxation and styling package',
    shortDescription: 'Head spa + Cut + Treatment',
    duration: 150,
    price: 12000,
    discountPrice: 10000,
    taxIncluded: true,
    isPackage: true,
    requiresConsultation: false,
    allowOnlineBooking: true,
    isActive: true,
    sortOrder: 5,
  }
  await db.insert(schema.services).values({
    ...rowOf('osaka', 'Spa & Cut Package', spaAndCut),
    packageServiceIds: [
      plain.osaka['Head Spa (30 min)'].id,
      plain.osaka['Scalp Treatment'].id,
      plain.osaka['Signature Cut'].id,
    ],
  })

  // The options of the ladies' cut
  await db.insert(schema.serviceOptions).values([
    {
      serviceId: plain.tokyo['Ladies Cut'].id,
      name: 'Fringe Trim',
      description: 'Quick fringe/bangs trim',
      additionalTime: 10,
      additionalPrice: 500,
      isRequired: false,
      sortOrder: 1,
      isActive: true,
    },
    {
      serviceId: plain.tokyo['Ladies Cut'].id,
      name: 'Hair Treatment Add-on',
      description: 'Add deep conditioning treatment',
      additionalTime: 20,
      additionalPrice: 2000,
      isRequired: false,
      sortOrder: 2,
      isActive: true,
    },
  ])

  return {
    tokyo: plain.tokyo,
    osaka: { ...plain.osaka, 'Spa & Cut Package': spaAndCut },
  }
}
