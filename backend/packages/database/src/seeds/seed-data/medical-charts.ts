import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'

/**
 * The medical charts of the first and the third customer, as the staff
 * filled them in at their first visits. The second customer and the VIP
 * customer have none yet. The previous treatments are objects of the API
 * model `PreviousTreatment`, as the `jsonb` column keeps them.
 */
export async function seedMedicalCharts(
  db: PostgresJsDatabase<typeof schema>,
  customerIds: string[],
): Promise<void> {
  const [first, , third] = customerIds
  if (first === undefined || third === undefined) {
    return
  }

  await db.insert(schema.medicalCharts).values([
    {
      customerId: first,
      previousTreatments: [
        {
          treatment: 'color',
          date: '2026-03-14',
          salonName: 'Hair Studio Aoyama',
          notes: 'ブリーチ 1 回のハイライト',
        },
        {
          treatment: 'perm',
          date: '2025-11-02',
          salonName: null,
          notes: null,
        },
      ],
      medicalConditions: '頭皮が乾燥しやすく、季節の変わり目にかゆみが出る',
      preferredProducts: ['Aveda', 'オーガニックシャンプー'],
      avoidProducts: ['強い香料の整髪料'],
      notes: 'シャンプーはぬるめのお湯を希望',
    },
    {
      customerId: third,
      previousTreatments: [],
      medicalConditions:
        '腰痛があり、長い時間同じ姿勢でいるのがつらい。施術の途中で休憩をはさむ',
      preferredProducts: [],
      avoidProducts: [],
      notes: null,
    },
  ])
}
