import { Table, useSay } from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ColumnGuide } from '../../utils/customer-file'
import styles from './file-columns.module.css'

const { columns: words } = adminCustomerMessages.file

export type FileColumnsProps = {
  /** The columns a file of customers may have, in the order of the export */
  columns: readonly ColumnGuide[]
}

/**
 * The columns of a file of customers: the name the first row gives each,
 * which stands as the file writes it in every language, what it holds,
 * and how it is written.
 */
export const FileColumns = ({ columns }: FileColumnsProps) => {
  const say = useSay()

  return (
    <Table
      caption={say(words.caption)}
      columns={[
        {
          key: 'column',
          header: say(words.name),
          cell: ({ column }) => (
            <code className={styles['name']}>{column}</code>
          ),
        },
        {
          key: 'label',
          header: say(words.item),
          cell: ({ label }) => say(label),
        },
        { key: 'how', header: say(words.how), cell: ({ how }) => say(how) },
      ]}
      rows={columns}
      rowKey={({ column }) => column}
      emptyMessage={say(words.empty)}
    />
  )
}
