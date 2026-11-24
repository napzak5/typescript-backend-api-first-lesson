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
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import { adminChartMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { treatmentNameOf } from '../../utils/chart-form'
import styles from './chart-record.module.css'

const { record, words } = adminChartMessages

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
}: ChartRecordProps) => {
  const say = useSay()

  return chart === null ? (
    <Card
      title={say(words.chart)}
      actions={
        <ButtonLink href={entryHref} variant='primary'>
          {say(words.entry)}
        </ButtonLink>
      }
    >
      <p>{say(record.none)}</p>
    </Card>
  ) : (
    <div className={styles['record']}>
      <Card
        title={say(words.chart)}
        actions={<ButtonLink href={changeHref}>{say(words.change)}</ButtonLink>}
      >
        <DescriptionList
          items={[
            {
              term: say(words.medicalConditions),
              description: <WrittenText>{chart.medicalConditions}</WrittenText>,
            },
            {
              term: say(words.preferredProducts),
              description: (
                <TagList
                  label={say(words.preferredProducts)}
                  items={chart.preferredProducts}
                />
              ),
            },
            {
              term: say(words.avoidProducts),
              description: (
                <TagList
                  label={say(words.avoidProducts)}
                  items={chart.avoidProducts}
                />
              ),
            },
            {
              term: say(words.notes),
              description: <WrittenText>{chart.notes}</WrittenText>,
            },
            {
              term: say(words.updatedAt),
              description: say(momentNameAt(chart.updatedAt, timezone)),
            },
          ]}
        />
      </Card>
      <Card title={say(words.previousTreatments)}>
        <Table<Row>
          caption={say(record.previousTreatmentsCaption)}
          captionHidden
          columns={[
            {
              key: 'date',
              header: say(words.date),
              cell: ({ treatment: { date } }) => say(dayNameOf(date)),
            },
            {
              key: 'treatment',
              header: say(words.treatment),
              cell: ({ treatment: { treatment } }) =>
                say(treatmentNameOf(treatment)),
            },
            {
              key: 'salonName',
              header: say(words.salonName),
              cell: ({ treatment: { salonName } }) => salonName,
            },
            {
              key: 'notes',
              header: say(words.notes),
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
          emptyMessage={say(record.noPreviousTreatments)}
        />
      </Card>
    </div>
  )
}
