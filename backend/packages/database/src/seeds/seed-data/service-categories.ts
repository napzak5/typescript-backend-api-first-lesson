import { randomUUID } from 'node:crypto'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import { SALON_KEYS, type SalonKey, type SeededSalons } from './salons'

/** The kinds of service, each of which has a category in every salon. */
export type CategoryKind = (typeof schema.serviceCategory.enumValues)[number]

/** The category of every kind in every salon. */
export type SeededCategories = Readonly<
  Record<SalonKey, Readonly<Record<CategoryKind, string>>>
>

type Category = {
  name: string
  description: string
  displayOrder: number
  color: string
}

/** What every salon calls the category of each kind, in the order it shows them. */
const CATEGORIES: Readonly<Record<CategoryKind, Category>> = {
  cut: {
    name: 'Hair Cut',
    description: 'Professional hair cutting services',
    displayOrder: 1,
    color: '#FF6B6B',
  },
  color: {
    name: 'Hair Color',
    description: 'Hair coloring and highlighting services',
    displayOrder: 2,
    color: '#4ECDC4',
  },
  perm: {
    name: 'Perm',
    description: 'Permanent wave and straightening services',
    displayOrder: 3,
    color: '#45B7D1',
  },
  treatment: {
    name: 'Hair Treatment',
    description: 'Hair care and treatment services',
    displayOrder: 4,
    color: '#96CEB4',
  },
  spa: {
    name: 'Head Spa',
    description: 'Relaxing head spa and scalp treatments',
    displayOrder: 5,
    color: '#DDA0DD',
  },
  styling: {
    name: 'Styling',
    description: 'Professional hair styling services',
    displayOrder: 6,
    color: '#FFD93D',
  },
  extension: {
    name: 'Hair Extension',
    description: 'Hair extension and volume services',
    displayOrder: 7,
    color: '#6BCB77',
  },
  other: {
    name: 'Other Services',
    description: 'Additional beauty services',
    displayOrder: 8,
    color: '#B8B8B8',
  },
}

const categoryIds = (): Record<CategoryKind, string> => ({
  cut: randomUUID(),
  color: randomUUID(),
  perm: randomUUID(),
  treatment: randomUUID(),
  spa: randomUUID(),
  styling: randomUUID(),
  extension: randomUUID(),
  other: randomUUID(),
})

export async function seedServiceCategories(
  db: PostgresJsDatabase<typeof schema>,
  salons: SeededSalons,
): Promise<SeededCategories> {
  const categories: SeededCategories = {
    tokyo: categoryIds(),
    osaka: categoryIds(),
  }

  await db.insert(schema.serviceCategories).values(
    SALON_KEYS.flatMap((salon) =>
      schema.serviceCategory.enumValues.map((category) => ({
        ...CATEGORIES[category],
        id: categories[salon][category],
        salonId: salons[salon].id,
        category,
        isActive: true,
      })),
    ),
  )

  return categories
}
