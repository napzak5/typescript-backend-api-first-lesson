import { randomUUID } from 'node:crypto'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'

/** The two salons: Tokyo, whose owner and manager are seeded, and Osaka. */
export type SalonKey = 'tokyo' | 'osaka'

/** The salons in the order they are seeded. */
export const SALON_KEYS: readonly SalonKey[] = ['tokyo', 'osaka']

/** A salon of the seed, and the time zone in which its days are counted. */
interface SeededSalon {
  readonly id: string
  readonly timezone: string
}

export type SeededSalons = Readonly<Record<SalonKey, SeededSalon>>

/** Both salons are in Japan: the time zone a salon has unless it says another. */
const JAPAN = 'Asia/Tokyo'

export async function seedSalons(
  db: PostgresJsDatabase<typeof schema>,
): Promise<SeededSalons> {
  const salons: SeededSalons = {
    tokyo: { id: randomUUID(), timezone: JAPAN },
    osaka: { id: randomUUID(), timezone: JAPAN },
  }
  await db.insert(schema.salons).values([
    {
      ...salons.tokyo,
      name: 'Beauty Studio Tokyo',
      description: 'Premium beauty salon in the heart of Tokyo',
      prefecture: 'Tokyo',
      city: 'Shibuya-ku',
      address: '1-2-3 Shibuya',
      phoneNumber: '+81-3-1234-5678',
      email: 'info@beautystudio-tokyo.jp',
      postalCode: '150-0002',
      websiteUrl: 'https://beautystudio-tokyo.jp',
      businessHours: [
        {
          dayOfWeek: 'monday',
          operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
          breakSlots: null,
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'tuesday',
          operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
          breakSlots: null,
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'wednesday',
          operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
          breakSlots: null,
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'thursday',
          operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
          breakSlots: null,
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'friday',
          operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
          breakSlots: null,
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'saturday',
          operatingSlots: [{ startTime: '10:00', endTime: '18:00' }],
          breakSlots: null,
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'sunday',
          operatingSlots: [],
          breakSlots: null,
          isClosed: true,
          effectivePeriod: null,
        },
      ],
      amenities: [],
      features: ['Hair Styling', 'Hair Color', 'Treatment', 'Head Spa'],
      imageUrls: [
        'https://example.com/images/salon1-1.jpg',
        'https://example.com/images/salon1-2.jpg',
      ],
    },
    {
      ...salons.osaka,
      name: 'Hair & Spa Osaka',
      description: 'Relaxing hair salon and spa in Osaka',
      prefecture: 'Osaka',
      city: 'Naniwa-ku',
      address: '4-5-6 Namba',
      phoneNumber: '+81-6-9876-5432',
      email: 'contact@hairspa-osaka.jp',
      postalCode: '556-0011',
      websiteUrl: 'https://hairspa-osaka.jp',
      businessHours: [
        {
          dayOfWeek: 'monday',
          operatingSlots: [{ startTime: '09:00', endTime: '19:00' }],
          breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'tuesday',
          operatingSlots: [{ startTime: '09:00', endTime: '19:00' }],
          breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'wednesday',
          operatingSlots: [],
          breakSlots: null,
          isClosed: true,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'thursday',
          operatingSlots: [{ startTime: '09:00', endTime: '19:00' }],
          breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'friday',
          operatingSlots: [{ startTime: '09:00', endTime: '19:00' }],
          breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'saturday',
          operatingSlots: [{ startTime: '09:00', endTime: '19:00' }],
          breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
          isClosed: false,
          effectivePeriod: null,
        },
        {
          dayOfWeek: 'sunday',
          operatingSlots: [{ startTime: '09:00', endTime: '17:00' }],
          breakSlots: null,
          isClosed: false,
          effectivePeriod: null,
        },
      ],
      amenities: [],
      features: ['Hair Cut', 'Spa', 'Color', 'Perm', 'Treatment'],
      imageUrls: [
        'https://example.com/images/salon2-1.jpg',
        'https://example.com/images/salon2-2.jpg',
        'https://example.com/images/salon2-3.jpg',
      ],
    },
  ])

  return salons
}
