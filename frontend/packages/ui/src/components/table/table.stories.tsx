import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from '../badge/badge'
import { Table, type TableColumn, type TableProps } from './table'

type Booking = {
  id: string
  customerName: string
  startsAt: string
  serviceName: string
  status: '確定' | '仮予約'
  totalAmount: number
  notes: string
}

const bookings: Booking[] = [
  {
    id: 'b1',
    customerName: '山田 花子',
    startsAt: '12/3（木）10:00',
    serviceName: 'カット',
    status: '確定',
    totalAmount: 5500,
    notes: '前回より短めに。\n耳は出さない。',
  },
  {
    id: 'b2',
    customerName: '鈴木 一郎',
    startsAt: '12/3（木）11:30',
    serviceName: 'カット、カラー',
    status: '仮予約',
    totalAmount: 13200,
    notes: '',
  },
  {
    id: 'b3',
    customerName: '高橋 彩',
    startsAt: '12/3（木）14:00',
    serviceName: 'パーマ',
    status: '確定',
    totalAmount: 9900,
    notes:
      'https://example.com/a-photo-of-the-style-the-customer-showed-at-the-last-visit',
  },
]

/** `Table` is generic in its row; the stories are those of a table of bookings. */
const BookingTable = (props: TableProps<Booking>) => <Table {...props} />

const CUSTOMER: TableColumn<Booking> = {
  key: 'customer',
  header: 'お客様',
  cell: (row) => row.customerName,
}

const STARTS_AT: TableColumn<Booking> = {
  key: 'startsAt',
  header: '開始',
  cell: (row) => row.startsAt,
}

const meta: Meta<typeof BookingTable> = {
  title: 'Components/Table',
  component: BookingTable,
  args: {
    caption: '今日の予約',
    columns: [
      CUSTOMER,
      STARTS_AT,
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

/** The rows are named by a column that is not the first */
export const RowHeaderNotFirst: Story = {
  args: {
    columns: [STARTS_AT, CUSTOMER],
    rowHeader: 'customer',
  },
}

/** Columns of text: the services break between words, the notes keep their lines */
export const WithText: Story = {
  args: {
    columns: [
      CUSTOMER,
      {
        key: 'service',
        header: 'メニュー',
        wrap: 'words',
        cell: (row) => row.serviceName,
      },
      {
        key: 'notes',
        header: '申し送り',
        wrap: 'lines',
        cell: (row) => row.notes,
      },
    ],
  },
}
