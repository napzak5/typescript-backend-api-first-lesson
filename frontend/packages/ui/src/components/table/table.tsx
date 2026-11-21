import { type ReactNode, useId, useRef } from 'react'
import { classNames } from '../../class-names'
import { NotRecorded } from '../not-recorded/not-recorded'
import { visuallyHiddenClass } from '../visually-hidden/visually-hidden'
import { useScrollsSideways } from './scrolls-sideways'
import styles from './table.module.css'

type ColumnAlignment = 'start' | 'end'

/**
 * `words` for a column of sentences (a reason, a list of names): its cells
 * break their lines between words. `lines` for what somebody wrote in lines
 * (notes, what a customer reported): its cells keep those lines and break
 * long ones. Either is never narrower than a few words, nor wider than a
 * column that is easy to read.
 */
type ColumnWrap = 'words' | 'lines'

export type TableColumn<Row> = {
  /** Tells the columns apart; it is not shown */
  key: string
  header: string
  /** What the cell of a row holds, or `null` when it was not recorded: it is then said as 「記録なし」 */
  cell: (row: Row) => ReactNode
  /** `end` for numbers and amounts, so that their digits line up */
  align?: ColumnAlignment | undefined
  /** How the cells of a column of text break their lines; by default they keep one */
  wrap?: ColumnWrap | undefined
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
}

const alignmentClass: Record<ColumnAlignment, string | undefined> = {
  start: undefined,
  end: styles['end'],
}

const wrapClass: Record<ColumnWrap, string | undefined> = {
  words: styles['words'],
  lines: styles['lines'],
}

/** What a cell holds, in the room its column gives text */
const contentOf = <Row,>(column: TableColumn<Row>, row: Row): ReactNode => {
  const value = column.cell(row)
  const shown = value === null ? <NotRecorded /> : value

  return column.wrap === undefined ? (
    shown
  ) : (
    <span className={wrapClass[column.wrap]}>{shown}</span>
  )
}

/**
 * A list of records, one row each. A table that is wider than its room
 * scrolls sideways inside its own frame, which is then a region of the
 * name of the table that the keyboard can reach; one that fits is neither,
 * so that a page of tables adds no stops to the Tab key.
 */
export const Table = <Row,>({
  caption,
  captionHidden = false,
  columns,
  rowHeader,
  rows,
  rowKey,
  emptyMessage,
}: TableProps<Row>) => {
  const captionId = useId()
  const header = rowHeader ?? columns[0]?.key
  const frame = useRef<HTMLElement>(null)
  const scrolls = useScrollsSideways(frame)

  return (
    <section
      className={styles['frame']}
      ref={frame}
      aria-labelledby={scrolls ? captionId : undefined}
      // What scrolls has to be reachable with the keyboard, or its far
      // columns cannot be read without a pointer (WCAG 2.1.1)
      tabIndex={scrolls ? 0 : undefined}
    >
      <table className={styles['table']}>
        <caption
          className={classNames(
            styles['caption'],
            captionHidden && visuallyHiddenClass,
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
                    {contentOf(column, row)}
                  </th>
                ) : (
                  <td
                    key={column.key}
                    className={alignmentClass[column.align ?? 'start']}
                  >
                    {contentOf(column, row)}
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
