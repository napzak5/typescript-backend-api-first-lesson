import { randomUUID } from 'node:crypto'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import type { SeededVisits, VisitKey } from './bookings'
import type { SeededStockRows, StockedCode } from './products'

/** What a seeded record says of a treatment, beside its booking. */
type SeededTreatment = {
  /** The visit the record is of. */
  visit: VisitKey
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
  materials: {
    productCode: StockedCode
    quantity: string
    notes: string | null
  }[]
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
 * What the visits of the first salon that took place came to: a cut with a
 * treatment, a men's cut without materials, and a colour with a cut. The salon keeps products of its own, which the other
 * salon does not.
 */
const TREATMENTS: readonly SeededTreatment[] = [
  {
    visit: 'firstCutAndTreatment',
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
    visit: 'thirdMensCut',
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
    visit: 'vipColorAndCut',
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
  visits: SeededVisits,
  stock: SeededStockRows,
): Promise<void> {
  for (const { visit: visitKey, materials, photos, ...stated } of TREATMENTS) {
    const visit = visits[visitKey]
    const [firstService] = visit.services
    const nextVisit = new Date(`${visit.bookingDate}T00:00:00Z`)
    nextVisit.setUTCDate(nextVisit.getUTCDate() + 28)
    const recordId = randomUUID()

    await db.insert(schema.treatmentRecords).values({
      ...stated,
      id: recordId,
      bookingId: visit.id,
      customerId: visit.customerId,
      staffId: visit.staffId,
      services: [...visit.services],
      nextRecommendedDate: nextVisit.toISOString().slice(0, 10),
      nextRecommendedServices: [firstService],
    })

    if (materials.length > 0) {
      await db.insert(schema.treatmentMaterials).values(
        materials.map(({ productCode, quantity, notes }, sortOrder) => {
          const { productId, unit, lotNumber } = stock[productCode]
          return {
            treatmentRecordId: recordId,
            productId,
            quantity,
            unit,
            lotNumber,
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
          treatmentRecordId: recordId,
          photoUrl: `https://images.example.com/treatments/${recordId}/${file}`,
          thumbnailUrl: null,
          sortOrder,
        })),
      )
    }
  }
}
