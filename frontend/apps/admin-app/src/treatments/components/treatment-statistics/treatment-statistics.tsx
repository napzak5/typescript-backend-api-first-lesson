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
  Note,
  Table,
  useSay,
} from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import {
  adminMenuMessages,
  adminTreatmentMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { serviceNameOf } from '../../../bookings/utils/day-bookings'
import { averageNameOf } from '../../utils/treatment-statistics'
import styles from './treatment-statistics.module.css'

const { recordsOf } = adminTreatmentMessages
const { byCategory, count, topServices } = adminTreatmentMessages.statistics

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
}: TreatmentStatisticsProps) => {
  const say = useSay()
  const average = averageNameOf(statistics.averageProcessingTime)

  return (
    <div className={styles['statistics']}>
      <Card title={say(count.title)}>
        <DescriptionList
          items={[
            {
              term: say(count.records),
              description: say(recordsOf(statistics.totalTreatments)),
            },
            {
              term: say(count.average),
              description: average === null ? null : say(average),
            },
          ]}
        />
      </Card>
      <Card title={say(byCategory.title)}>
        <div className={styles['part']}>
          <Table<ModelsTreatmentsByCategoryResponse>
            caption={say(byCategory.caption)}
            captionHidden
            columns={[
              {
                key: 'category',
                header: say(byCategory.category),
                cell: ({ category }) => say(categoryNameOf(category)),
              },
              {
                key: 'count',
                header: say(byCategory.records),
                align: 'end',
                cell: (counted) => say(recordsOf(counted.count)),
              },
            ]}
            rows={statistics.treatmentsByCategory}
            rowKey={({ category }) => category}
            emptyMessage={say(byCategory.none)}
          />
          <Note>{say(byCategory.note)}</Note>
        </div>
      </Card>
      <Card title={say(topServices.title)}>
        <Table<Ranked>
          caption={say(topServices.title)}
          captionHidden
          columns={[
            {
              key: 'rank',
              header: say(topServices.rank),
              align: 'end',
              cell: ({ rank }) => say(formats.placeOf(rank)),
            },
            {
              key: 'service',
              header: say(topServices.service),
              cell: ({ counted }) =>
                serviceNameOf(counted.serviceId, services) ??
                say(adminMenuMessages.removedService),
            },
            {
              key: 'count',
              header: say(topServices.records),
              align: 'end',
              cell: ({ counted }) => say(recordsOf(counted.count)),
            },
          ]}
          rowHeader='service'
          rows={statistics.topServices.map((counted, index) => ({
            rank: index + 1,
            counted,
          }))}
          rowKey={({ counted }) => counted.serviceId}
          emptyMessage={say(topServices.none)}
        />
      </Card>
    </div>
  )
}
