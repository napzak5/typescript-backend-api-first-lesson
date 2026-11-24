import type { ModelsCustomerDeletionRequestResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { Table, type TableColumn, useSay } from '@beauty-salon-frontend/ui'
import { adminOperationMessages } from '@beauty-salon-shared/i18n/messages/admin'

const { table } = adminOperationMessages.erasure

export type ExecutedRequestsProps = {
  /** The requests a run carried out, in the order of their dates */
  requests: readonly ModelsCustomerDeletionRequestResponse[]
  /** The time zone of the device, which the moments are shown in */
  timezone: string
}

/**
 * The deletion requests a run carried out: when each was received, when
 * it became due, and why it was made. The customer is not named: the run
 * erased the name, and the ledger shows no more of the customer.
 */
export const ExecutedRequests = ({
  requests,
  timezone,
}: ExecutedRequestsProps) => {
  const say = useSay()
  const columns: TableColumn<ModelsCustomerDeletionRequestResponse>[] = [
    {
      key: 'requestedAt',
      header: say(table.requestedAt),
      cell: ({ requestedAt }) => say(momentNameAt(requestedAt, timezone)),
    },
    {
      key: 'scheduledAt',
      header: say(table.scheduledAt),
      cell: ({ scheduledAt }) => say(momentNameAt(scheduledAt, timezone)),
    },
    {
      key: 'reason',
      header: say(table.reason),
      wrap: 'lines',
      cell: ({ reason }) => reason,
    },
  ]

  return (
    <Table
      caption={say(table.caption)}
      columns={columns}
      rows={requests}
      rowKey={({ id }) => id}
      emptyMessage={say(table.none)}
    />
  )
}
