import type {
  ModelsMedicalChartResponse,
  ModelsPreviousTreatment,
} from '@beauty-salon-frontend/api-client'
import { dayNameOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  Card,
  DescriptionList,
  Table,
  TagList,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import { treatmentNameOf } from '../../utils/chart-form'
import styles from './chart-record.module.css'

export type ChartRecordProps = {
  /** The chart of the customer; `null` for one who has none yet */
  chart: ModelsMedicalChartResponse | null
  /** The time zone of the salon, which the moment the chart was written is shown in */
  timezone: string
  /** The screen that makes the chart */
  entryHref: string
  /** The screen that changes the chart */
  changeHref: string
}

/** A treatment of the chart, at its place in the list */
type Row = { place: number; treatment: ModelsPreviousTreatment }

/**
 * The chart of a customer, as a member of the staff reads it before a
 * treatment: what to take care of, the products the customer likes and
 * those to avoid, the notes, then the treatments they had before (at other
 * salons, or before the salon kept charts), in the order they were
 * written. A customer without a chart is told what one
 * holds, and offered to make it.
 */
export const ChartRecord = ({
  chart,
  timezone,
  entryHref,
  changeHref,
}: ChartRecordProps) =>
  chart === null ? (
    <Card
      title='カルテ'
      actions={
        <ButtonLink href={entryHref} variant='primary'>
          カルテを作る
        </ButtonLink>
      }
    >
      <p>
        このお客様のカルテは、まだありません。カルテには、施術の前に注意が必要な持病や体調、好みの商材と避ける商材、ほかのサロンで受けた施術を書き、施術の前に確かめます。
      </p>
    </Card>
  ) : (
    <div className={styles['record']}>
      <Card
        title='カルテ'
        actions={<ButtonLink href={changeHref}>カルテを直す</ButtonLink>}
      >
        <DescriptionList
          items={[
            {
              term: '持病や体調',
              description: <WrittenText>{chart.medicalConditions}</WrittenText>,
            },
            {
              term: '好みの商材',
              description: (
                <TagList label={'好みの商材'} items={chart.preferredProducts} />
              ),
            },
            {
              term: '避ける商材',
              description: (
                <TagList label={'避ける商材'} items={chart.avoidProducts} />
              ),
            },
            {
              term: 'メモ',
              description: <WrittenText>{chart.notes}</WrittenText>,
            },
            {
              term: '最後に書いた日時',
              description: momentNameAt(chart.updatedAt, timezone),
            },
          ]}
        />
      </Card>
      <Card title='過去の施術'>
        <Table<Row>
          caption='過去の施術の一覧'
          captionHidden
          columns={[
            {
              key: 'date',
              header: '施術日',
              cell: ({ treatment: { date } }) => dayNameOf(date),
            },
            {
              key: 'treatment',
              header: '施術',
              cell: ({ treatment: { treatment } }) =>
                treatmentNameOf(treatment),
            },
            {
              key: 'salonName',
              header: 'サロン',
              cell: ({ treatment: { salonName } }) => salonName,
            },
            {
              key: 'notes',
              header: 'メモ',
              wrap: 'lines',
              cell: ({ treatment: { notes } }) => notes,
            },
          ]}
          rows={chart.previousTreatments.map((treatment, place) => ({
            place,
            treatment,
          }))}
          // The treatments have no IDs: a row is its place in the list
          rowKey={({ place }) => String(place)}
          emptyMessage='記録はありません'
        />
      </Card>
    </div>
  )
