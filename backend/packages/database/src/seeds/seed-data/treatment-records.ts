import { and, asc, eq, inArray } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import type { CompletedBooking } from './bookings'

/** What a seeded record says of a treatment, beside its booking. */
type SeededTreatment = {
  techniques: string[]
  consultationNotes: string | null
  scalpCondition: string | null
  hairCondition: string | null
  colorFormula: string | null
  processingTime: number | null
  resultNotes: string | null
  homeCareSuggestions: string | null
  customerSatisfaction: number | null
  staffEvaluation: string | null
  /** The products used, by code, and how much of each. */
  materials: { productCode: string; quantity: string; notes: string | null }[]
  /** The photos taken, by the name of their file, in their order. */
  photos: {
    photoType: (typeof schema.treatmentPhotoType.enumValues)[number]
    file: string
    angle: string | null
    description: string | null
    isPublic: boolean
    customerConsent: boolean
  }[]
}

/**
 * What the visits of the first salon that took place came to, in the order
 * of the visits: a cut with a treatment, a men's cut without materials, and
 * a colour with a cut. The salon keeps products of its own, which the other
 * salon does not.
 */
const TREATMENTS: SeededTreatment[] = [
  {
    techniques: ['レイヤーカット', 'ディープコンディショニング'],
    consultationNotes: '毛先のパサつきが気になる。長さは肩につく程度を希望',
    scalpCondition: '健康',
    hairCondition: '毛先に乾燥とダメージ',
    colorFormula: null,
    processingTime: 75,
    resultNotes: null,
    homeCareSuggestions: '週 1 回の集中トリートメント',
    customerSatisfaction: 5,
    staffEvaluation: null,
    materials: [{ productCode: 'TREAT001', quantity: '15.00', notes: null }],
    photos: [
      {
        photoType: 'after',
        file: 'after-front.jpg',
        angle: '正面',
        description: null,
        isPublic: false,
        customerConsent: true,
      },
    ],
  },
  {
    techniques: [],
    consultationNotes: null,
    scalpCondition: null,
    hairCondition: null,
    colorFormula: null,
    processingTime: 45,
    resultNotes: null,
    homeCareSuggestions: null,
    customerSatisfaction: null,
    staffEvaluation: null,
    materials: [],
    photos: [],
  },
  {
    techniques: ['ワンメイクカラー', 'レイヤーカット'],
    consultationNotes: '前回より明るめのブラウンを希望。頭皮のしみる感じはなし',
    scalpCondition: 'やや乾燥',
    hairCondition: '中間から毛先に前回のカラーの退色',
    colorFormula: 'ブラウン 7 レベル 1:1、6% オキシ、放置 25 分',
    processingTime: 120,
    resultNotes: '根元と毛先の明るさをそろえた',
    homeCareSuggestions: 'カラー用シャンプーで退色を抑える',
    customerSatisfaction: 4,
    staffEvaluation: '次回は放置時間を 5 分短くする',
    materials: [
      { productCode: 'COLOR001', quantity: '1.00', notes: null },
      { productCode: 'DEVELOPER001', quantity: '0.50', notes: '6% を使用' },
    ],
    photos: [
      {
        photoType: 'before',
        file: 'before-side.jpg',
        angle: '側面',
        description: '中間から毛先の退色',
        isPublic: false,
        customerConsent: true,
      },
      {
        photoType: 'after',
        file: 'after-side.jpg',
        angle: '側面',
        description: null,
        isPublic: true,
        customerConsent: true,
      },
    ],
  },
]

/**
 * Treatment records of the visits of the first salon that took place, as
 * its staff would write them through the API: the services of the visit,
 * the staff member in charge, the next visit recommended four weeks after
 * the visit with its first service, the materials with the lots of the
 * salon's stock rows, and the photos at addresses of the record. Recording
 * a material moves no stock.
 */
export async function seedTreatmentRecords(
  db: PostgresJsDatabase<typeof schema>,
  completedBookings: CompletedBooking[],
  salonId: string,
): Promise<string[]> {
  const visits = completedBookings.filter(
    (booking) => booking.salonId === salonId,
  )
  const lines = await db
    .select({
      bookingId: schema.bookingServices.bookingId,
      serviceId: schema.bookingServices.serviceId,
      bookingDate: schema.bookings.bookingDate,
    })
    .from(schema.bookingServices)
    .innerJoin(
      schema.bookings,
      eq(schema.bookings.id, schema.bookingServices.bookingId),
    )
    .where(
      inArray(
        schema.bookingServices.bookingId,
        visits.map(({ id }) => id),
      ),
    )
    .orderBy(
      asc(schema.bookingServices.startTime),
      asc(schema.bookingServices.id),
    )
  const stock = await db
    .select({
      productId: schema.products.id,
      productCode: schema.products.productCode,
      unit: schema.products.unit,
      lotNumber: schema.inventory.lotNumber,
    })
    .from(schema.products)
    .innerJoin(
      schema.inventory,
      eq(schema.inventory.productId, schema.products.id),
    )
    .where(
      and(
        eq(schema.products.salonId, salonId),
        eq(schema.inventory.salonId, salonId),
      ),
    )

  const written: string[] = []
  for (const [index, treatment] of TREATMENTS.entries()) {
    const visit = visits[index]
    if (visit === undefined) {
      break
    }
    const services = lines.filter(({ bookingId }) => bookingId === visit.id)
    const [first] = services
    if (first === undefined) {
      throw new Error(`The seeded booking ${visit.id} has no service lines`)
    }
    const nextVisit = new Date(`${first.bookingDate}T00:00:00Z`)
    nextVisit.setUTCDate(nextVisit.getUTCDate() + 28)
    const { materials, photos, ...stated } = treatment

    const [record] = await db
      .insert(schema.treatmentRecords)
      .values({
        ...stated,
        bookingId: visit.id,
        customerId: visit.customerId,
        staffId: visit.staffId,
        services: services.map(({ serviceId }) => serviceId),
        nextRecommendedDate: nextVisit.toISOString().slice(0, 10),
        nextRecommendedServices: [first.serviceId],
      })
      .returning({ id: schema.treatmentRecords.id })
    if (record === undefined) {
      throw new Error('The treatment record was not written')
    }

    if (materials.length > 0) {
      await db.insert(schema.treatmentMaterials).values(
        materials.map(({ productCode, quantity, notes }, sortOrder) => {
          const row = stock.find((kept) => kept.productCode === productCode)
          if (row === undefined) {
            throw new Error(`The salon keeps no stock of ${productCode}`)
          }
          return {
            treatmentRecordId: record.id,
            productId: row.productId,
            quantity,
            unit: row.unit,
            lotNumber: row.lotNumber,
            notes,
            sortOrder,
          }
        }),
      )
    }
    if (photos.length > 0) {
      await db.insert(schema.treatmentPhotos).values(
        photos.map(({ file, ...photo }, sortOrder) => ({
          ...photo,
          treatmentRecordId: record.id,
          photoUrl: `https://images.example.com/treatments/${record.id}/${file}`,
          thumbnailUrl: null,
          sortOrder,
        })),
      )
    }
    written.push(record.id)
  }

  return written
}
