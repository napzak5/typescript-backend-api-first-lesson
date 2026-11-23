import type { ModelsHealthCheck } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  Card,
  DescriptionList,
  type DescriptionListItem,
  inJapanese,
  Table,
  type TableColumn,
} from '@beauty-salon-frontend/ui'
import type { SystemState } from '../../api/operations-api'
import {
  checkNameOf,
  dependencyNameOf,
  healthNameOf,
  livenessNameOf,
  readinessNameOf,
  responseTimeNameOf,
} from '../../utils/operations'
import styles from './system-state.module.css'

export type SystemStateRecordProps = {
  state: SystemState
  /** When the probes were asked */
  readAt: string
  /** The time zone of the device, which the moment is shown in */
  timezone: string
  /** The probes are being asked again */
  checking?: boolean | undefined
  /** The button that asks the probes again was pressed */
  onCheck: () => void
}

const COLUMNS: TableColumn<ModelsHealthCheck>[] = [
  {
    key: 'name',
    header: '依存先',
    cell: ({ name }) => dependencyNameOf(name),
  },
  { key: 'status', header: '状態', cell: ({ status }) => checkNameOf(status) },
  {
    key: 'responseTime',
    header: '応答時間',
    cell: ({ responseTime }) => responseTimeNameOf(responseTime),
    align: 'end',
  },
  {
    key: 'error',
    header: 'エラー',
    wrap: 'words',
    cell: ({ error }) => error ?? 'ありません',
  },
]

/**
 * What the three probes of the API said, for an administrator who is told
 * that the screens do not answer: whether the process runs, whether it
 * takes requests and what keeps it from doing so, and the state of each
 * thing it depends on with the time it took to answer. A probe that does
 * not answer says so, and the others are shown all the same.
 */
export const SystemStateRecord = ({
  state: { liveness, readiness, health },
  readAt,
  timezone,
  checking = false,
  onCheck,
}: SystemStateRecordProps) => {
  const items: DescriptionListItem[] = [
    { term: 'プロセス', description: livenessNameOf(liveness) },
    { term: 'リクエストの受け付け', description: readinessNameOf(readiness) },
    {
      term: '全体の状態',
      description:
        health.type === 'reported'
          ? healthNameOf(health.health.status)
          : '応答がありません',
    },
    ...(health.type === 'reported'
      ? [{ term: 'API のバージョン', description: health.health.version }]
      : []),
    {
      term: '確かめた日時',
      description: inJapanese(momentNameAt(readAt, timezone)),
    },
  ]

  return (
    <Card
      title='システムの状態'
      actions={
        <Button pending={checking} onClick={onCheck}>
          もう一度確かめる
        </Button>
      }
    >
      <div className={styles['state']}>
        <DescriptionList items={items} />
        {health.type === 'reported' && (
          <Table
            caption='依存先の状態'
            columns={COLUMNS}
            rows={health.health.checks}
            rowKey={({ name }) => name}
            emptyMessage='API が確かめる依存先はありません'
          />
        )}
      </div>
    </Card>
  )
}
