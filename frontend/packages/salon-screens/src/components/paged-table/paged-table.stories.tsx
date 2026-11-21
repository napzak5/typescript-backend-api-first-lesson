import { Link } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PagedTable } from './paged-table'

type Visit = { id: string; name: string; time: string }

export const VISITS: Visit[] = [
  { id: 'visit-1', name: '山田 花子', time: '10:00' },
  { id: 'visit-2', name: '鈴木 一郎', time: '11:30' },
]

const meta: Meta<typeof PagedTable<Visit>> = {
  title: 'SalonScreens/PagedTable',
  component: PagedTable<Visit>,
  args: {
    caption: '来店',
    columns: [
      { key: 'time', header: '時刻', cell: ({ time }) => time },
      {
        key: 'name',
        header: 'お客様',
        cell: ({ id, name }) => <Link href={`#${id}`}>{name}</Link>,
      },
    ],
    rows: VISITS,
    rowKey: ({ id }) => id,
    emptyMessage: '来店はありません',
    count: '4 件（2 件を表示しています）',
    more: 'available',
    onMore: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** More rows can be asked for */
export const More: Story = {}

/** The next rows are on their way */
export const Loading: Story = {
  args: { more: 'loading' },
}

/** The next rows did not come */
export const Failed: Story = {
  args: { more: 'failed' },
}

/** Every row is shown */
export const Complete: Story = {
  args: { count: '2 件', more: 'none' },
}

/** Rows that lead nowhere: the cell that names a row is its header */
export const WithoutLinks: Story = {
  args: {
    columns: [
      { key: 'time', header: '時刻', cell: ({ time }) => time },
      { key: 'name', header: 'お客様', cell: ({ name }) => name },
    ],
  },
}
