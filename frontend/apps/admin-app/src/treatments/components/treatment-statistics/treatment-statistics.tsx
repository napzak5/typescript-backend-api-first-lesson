import type {
  ModelsServiceResponse,
  ModelsTreatmentStatisticsResponse,
  ModelsTreatmentsByCategoryResponse,
  ModelsTreatmentsByServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { categoryNameOf } from '@beauty-salon-frontend/salon-screens'
import {
  Card,
  DescriptionList,
  inJapanese,
  Note,
  Table,
} from '@beauty-salon-frontend/ui'
import { serviceNameOf } from '../../../bookings/utils/day-bookings'
import { GONE_SERVICE } from '../../utils/treatment-format'
import { averageNameOf, countNameOf } from '../../utils/treatment-statistics'
import styles from './treatment-statistics.module.css'

export type TreatmentStatisticsProps = {
  statistics: ModelsTreatmentStatisticsResponse
  /** The services of the salon */
  services: readonly Pick<ModelsServiceResponse, 'id' | 'name'>[]
}

/** A service, at its place among those with the most records */
type Ranked = { rank: number; counted: ModelsTreatmentsByServiceResponse }

/**
 * The treatment records of a period, counted: how many, how long the
 * treatments took on average, how many had a service of each kind, and
 * the services that most of them had. A record with services of two kinds
 * counts once for each, so the counts of the kinds may add up to more than
 * the records.
 */
export const TreatmentStatistics = ({
  statistics,
  services,
}: TreatmentStatisticsProps) => (
  <div className={styles['statistics']}>
    <Card title='施術記録の数'>
      <DescriptionList
        items={[
          {
            term: '施術記録',
            description: countNameOf(statistics.totalTreatments),
          },
          {
            term: '施術時間の平均',
            description: averageNameOf(statistics.averageProcessingTime),
          },
        ]}
      />
    </Card>
    <Card title='メニューの区分ごと'>
      <div className={styles['part']}>
        <Table<ModelsTreatmentsByCategoryResponse>
          caption='メニューの区分ごとの施術記録'
          captionHidden
          columns={[
            {
              key: 'category',
              header: 'メニューの区分',
              cell: ({ category }) => inJapanese(categoryNameOf(category)),
            },
            {
              key: 'count',
              header: '施術記録',
              align: 'end',
              cell: ({ count }) => countNameOf(count),
            },
          ]}
          rows={statistics.treatmentsByCategory}
          rowKey={({ category }) => category}
          emptyMessage='施術記録はありません'
        />
        <Note>
          いくつもの区分のサービスをした施術記録は、区分ごとに 1
          件と数えます。合わせた数は、施術記録の数より多いことがあります。
        </Note>
      </div>
    </Card>
    <Card title='施術記録の多いサービス'>
      <Table<Ranked>
        caption='施術記録の多いサービス'
        captionHidden
        columns={[
          {
            key: 'rank',
            header: '順位',
            align: 'end',
            cell: ({ rank }) => `${rank} 位`,
          },
          {
            key: 'service',
            header: 'サービス',
            cell: ({ counted }) =>
              serviceNameOf(counted.serviceId, services) ?? GONE_SERVICE,
          },
          {
            key: 'count',
            header: '施術記録',
            align: 'end',
            cell: ({ counted }) => countNameOf(counted.count),
          },
        ]}
        rowHeader='service'
        rows={statistics.topServices.map((counted, index) => ({
          rank: index + 1,
          counted,
        }))}
        rowKey={({ counted }) => counted.serviceId}
        emptyMessage='施術記録はありません'
      />
    </Card>
  </div>
)
