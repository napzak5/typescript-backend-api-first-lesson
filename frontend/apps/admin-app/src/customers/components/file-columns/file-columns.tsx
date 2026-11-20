import { Table } from '@beauty-salon-frontend/ui'
import type { ColumnGuide } from '../../customer-file'
import styles from './file-columns.module.css'

export type FileColumnsProps = {
  /** The columns a file of customers may have, in the order of the export */
  columns: readonly ColumnGuide[]
}

/**
 * The columns of a file of customers: the name the first row gives each,
 * what it holds, and how it is written.
 */
export const FileColumns = ({ columns }: FileColumnsProps) => (
  <Table
    caption='ファイルの列'
    columns={[
      {
        key: 'column',
        header: '列名',
        cell: ({ column }) => <code className={styles['name']}>{column}</code>,
      },
      { key: 'label', header: '項目', cell: ({ label }) => label },
      { key: 'how', header: '書き方', cell: ({ how }) => how },
    ]}
    rows={columns}
    rowKey={({ column }) => column}
    emptyMessage='列はありません'
  />
)
