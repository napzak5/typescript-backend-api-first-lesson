import type { ModelsCustomerDeletionRequestResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { Table, type TableColumn } from '@beauty-salon-frontend/ui'

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
  const columns: TableColumn<ModelsCustomerDeletionRequestResponse>[] = [
    {
      key: 'requestedAt',
      header: '受け付けた日時',
      cell: ({ requestedAt }) => momentNameAt(requestedAt, timezone),
    },
    {
      key: 'scheduledAt',
      header: '消去の予定日時',
      cell: ({ scheduledAt }) => momentNameAt(scheduledAt, timezone),
    },
    {
      key: 'reason',
      header: '依頼の理由',
      wrap: 'lines',
      cell: ({ reason }) => reason,
    },
  ]

  return (
    <Table
      caption='実行した依頼'
      columns={columns}
      rows={requests}
      rowKey={({ id }) => id}
      emptyMessage='実行した依頼はありません'
    />
  )
}
