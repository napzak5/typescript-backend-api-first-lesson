import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'

/**
 * The allergies of the first customer, whose medical chart says to stay
 * away from strong fragrances. The third customer has a chart and no
 * allergy, so the list of the charts can be filtered either way.
 */
export async function seedCustomerAllergies(
  db: PostgresJsDatabase<typeof schema>,
  customerIds: string[],
): Promise<void> {
  const [first] = customerIds
  if (first === undefined) {
    return
  }

  await db.insert(schema.customerAllergies).values([
    {
      customerId: first,
      allergyType: 'chemical',
      allergenName: 'パラフェニレンジアミン（PPD）',
      severityType: 'severe',
      symptoms: 'カラー剤で頭皮に赤みとかゆみが出た',
      notes: 'ジアミンを含まないカラー剤を使う',
      confirmedDate: '2025-06-10',
    },
    {
      customerId: first,
      allergyType: 'fragrance',
      allergenName: '強い香料',
      severityType: 'mild',
      symptoms: null,
      notes: '無香料のスタイリング剤を使う',
      confirmedDate: null,
    },
  ])
}
