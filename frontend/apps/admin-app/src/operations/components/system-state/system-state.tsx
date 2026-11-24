import type { ModelsHealthCheck } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  Card,
  DescriptionList,
  type DescriptionListItem,
  Table,
  type TableColumn,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminOperationMessages } from '@beauty-salon-shared/i18n/messages/admin'
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

const { system } = adminOperationMessages
const { table } = system

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
  const say = useSay()
  const columns: TableColumn<ModelsHealthCheck>[] = [
    {
      key: 'name',
      header: say(table.dependency),
      cell: ({ name }) => say(dependencyNameOf(name)),
    },
    {
      key: 'status',
      header: say(table.status),
      cell: ({ status }) => say(checkNameOf(status)),
    },
    {
      key: 'responseTime',
      header: say(table.responseTime),
      cell: ({ responseTime }) => say(responseTimeNameOf(responseTime)),
      align: 'end',
    },
    {
      key: 'error',
      header: say(table.error),
      wrap: 'words',
      cell: ({ error }) => error ?? say(table.noError),
    },
  ]
  const items: DescriptionListItem[] = [
    { term: say(system.process), description: say(livenessNameOf(liveness)) },
    {
      term: say(system.requests),
      description: say(readinessNameOf(readiness)),
    },
    {
      term: say(system.overall),
      description: say(
        health.type === 'reported'
          ? healthNameOf(health.health.status)
          : system.noAnswer,
      ),
    },
    ...(health.type === 'reported'
      ? [{ term: say(system.version), description: health.health.version }]
      : []),
    {
      term: say(system.checkedAt),
      description: say(momentNameAt(readAt, timezone)),
    },
  ]

  return (
    <Card
      title={say(system.title)}
      actions={
        <Button pending={checking} onClick={onCheck}>
          {say(system.checkAgain)}
        </Button>
      }
    >
      <div className={styles['state']}>
        <DescriptionList items={items} />
        {health.type === 'reported' && (
          <Table
            caption={say(table.caption)}
            columns={columns}
            rows={health.health.checks}
            rowKey={({ name }) => name}
            emptyMessage={say(table.none)}
          />
        )}
      </div>
    </Card>
  )
}
