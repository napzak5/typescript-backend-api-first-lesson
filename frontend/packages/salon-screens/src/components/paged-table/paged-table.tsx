import {
  Alert,
  Button,
  Table,
  type TableProps,
} from '@beauty-salon-frontend/ui'
import { useLayoutEffect, useRef } from 'react'
import type { More } from '../../pages'
import styles from './paged-table.module.css'

export type PagedTableProps<Row> = Omit<TableProps<Row>, 'className'> & {
  /** How many there are and how many are shown: 「12 件（10 件を表示しています）」 */
  count: string
  /**
   * What comes after the rows: nothing (`none`), a page that can be asked
   * for (`available`), one that is on its way (`loading`), or one that was
   * asked for and did not come (`failed`)
   */
  more: More
  /** Asks for the rows that come next */
  onMore: () => void
}

/**
 * A table whose rows are read a page at a time. When its button adds rows,
 * the focus moves to the link of the first of them, or to the cell that
 * names it when the row has no link: whoever pressed 「さらに表示」 goes on
 * reading where the new rows begin. Rows that nobody asked for (those of a
 * list that was read again) leave the focus where it is.
 */
export const PagedTable = <Row,>({
  count,
  more,
  onMore,
  rows,
  ...table
}: PagedTableProps<Row>) => {
  const frame = useRef<HTMLDivElement>(null)
  const shown = useRef(rows.length)
  // Whether the button was pressed and what it asked for is yet to be shown
  const asked = useRef(false)

  // In the commit that shows the added rows, before they are painted
  useLayoutEffect(() => {
    if (asked.current && rows.length > shown.current) {
      const added = frame.current
        ?.querySelectorAll('tbody tr')
        .item(shown.current)
      const link = added?.querySelector<HTMLAnchorElement>('a')
      const header = added?.querySelector<HTMLTableCellElement>('th')
      if (link !== null && link !== undefined) {
        link.focus()
      } else if (header !== null && header !== undefined) {
        // Out of the order of the keyboard: the focus is put there, and it is no control
        header.tabIndex = -1
        header.focus()
      }
      asked.current = false
    }
    shown.current = rows.length
  }, [rows.length])

  const askForMore = (): void => {
    asked.current = true
    onMore()
  }

  return (
    <div className={styles['pagedTable']} ref={frame}>
      <p className={styles['count']} role='status'>
        {count}
      </p>
      <Table {...table} rows={rows} />
      {more === 'failed' && (
        <Alert tone='danger'>
          続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。
        </Alert>
      )}
      {more !== 'none' && (
        <p>
          <Button onClick={askForMore} pending={more === 'loading'}>
            {more === 'failed' ? 'もう一度読み込む' : 'さらに表示'}
          </Button>
        </p>
      )}
    </div>
  )
}

/** How many there are, and how many of them are shown. */
export const countOf = (
  total: number | null,
  shown: number,
  unit: string,
): string => {
  if (total === null) {
    return `${shown} ${unit}を表示しています`
  }

  return shown < total
    ? `${total} ${unit}（${shown} ${unit}を表示しています）`
    : `${total} ${unit}`
}
