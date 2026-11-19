import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from '../badge/badge'
import { Table, type TableProps } from './table'

type Booking = {
  id: string
  customerName: string
  startsAt: string
  serviceName: string
  status: '確定' | '仮予約'
  totalAmount: number
}

const bookings: Booking[] = [
  {
    id: 'b1',
    customerName: '山田 花子',
    startsAt: '12/3（木）10:00',
    serviceName: 'カット',
    status: '確定',
    totalAmount: 5500,
  },
  {
    id: 'b2',
    customerName: '鈴木 一郎',
    startsAt: '12/3（木）11:30',
    serviceName: 'カット、カラー',
    status: '仮予約',
    totalAmount: 13200,
  },
  {
    id: 'b3',
    customerName: '高橋 彩',
    startsAt: '12/3（木）14:00',
    serviceName: 'パーマ',
    status: '確定',
    totalAmount: 9900,
  },
]

/** `Table` is generic in its row; the stories are those of a table of bookings. */
const BookingTable = (props: TableProps<Booking>) => <Table {...props} />

const meta: Meta<typeof BookingTable> = {
  title: 'Components/Table',
  component: BookingTable,
  args: {
    caption: '今日の予約',
    columns: [
      { key: 'customer', header: 'お客様', cell: (row) => row.customerName },
      { key: 'startsAt', header: '開始', cell: (row) => row.startsAt },
      { key: 'service', header: 'メニュー', cell: (row) => row.serviceName },
      {
        key: 'status',
        header: '状態',
        cell: (row) => (
          <Badge tone={row.status === '確定' ? 'success' : 'neutral'}>
            {row.status}
          </Badge>
        ),
      },
      {
        key: 'total',
        header: '金額',
        align: 'end',
        cell: (row) => `${row.totalAmount.toLocaleString('ja-JP')} 円`,
      },
    ],
    rows: bookings,
    rowKey: (row) => row.id,
    emptyMessage: '今日の予約はありません。',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutRows: Story = {
  args: { rows: [] },
}

/** A heading above says what the table lists; the caption stays for assistive technology. */
export const CaptionHidden: Story = {
  args: { captionHidden: true },
}
