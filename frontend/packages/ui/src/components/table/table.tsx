import { type ReactNode, useId } from 'react'
import { classNames } from '../../class-names'
import styles from './table.module.css'

type ColumnAlignment = 'start' | 'end'

export type TableColumn<Row> = {
  /** Tells the columns apart; it is not shown */
  key: string
  header: string
  cell: (row: Row) => ReactNode
  /** `end` for numbers and amounts, so that their digits line up */
  align?: ColumnAlignment | undefined
}

export type TableProps<Row> = {
  /** What the table lists: its name, for the eye and for assistive technology */
  caption: string
  /** Keeps the caption for assistive technology only, when a heading above says the same */
  captionHidden?: boolean | undefined
  /** The column that names the row (the first, unless `rowHeader` says another): its cells are the headers of their rows */
  columns: readonly TableColumn<Row>[]
  /** The key of the column that names the rows, when it is not the first: one of controls comes before it */
  rowHeader?: string | undefined
  rows: readonly Row[]
  rowKey: (row: Row) => string
  /** Said in place of the rows when there are none */
  emptyMessage: string
  className?: string | undefined
}

const alignmentClass: Record<ColumnAlignment, string | undefined> = {
  start: undefined,
  end: styles['end'],
}

/**
 * A list of records, one row each. A table that is wider than the screen
 * scrolls sideways inside its own frame, which the keyboard can reach.
 */
export const Table = <Row,>({
  caption,
  captionHidden = false,
  columns,
  rowHeader,
  rows,
  rowKey,
  emptyMessage,
  className,
}: TableProps<Row>) => {
  const captionId = useId()
  const header = rowHeader ?? columns[0]?.key

  return (
    <section
      className={classNames(styles['frame'], className)}
      aria-labelledby={captionId}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: what scrolls has to be reachable with the keyboard, or its far columns cannot be read without a pointer (WCAG 2.1.1)
      tabIndex={0}
    >
      <table className={styles['table']}>
        <caption
          className={classNames(
            styles['caption'],
            captionHidden && styles['captionHidden'],
          )}
          id={captionId}
        >
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={alignmentClass[column.align ?? 'start']}
                scope='col'
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className={styles['empty']} colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) =>
                column.key === header ? (
                  <th
                    key={column.key}
                    className={alignmentClass[column.align ?? 'start']}
                    scope='row'
                  >
                    {column.cell(row)}
                  </th>
                ) : (
                  <td
                    key={column.key}
                    className={alignmentClass[column.align ?? 'start']}
                  >
                    {column.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
