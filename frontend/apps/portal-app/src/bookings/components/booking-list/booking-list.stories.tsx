import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { rows, rowWithoutNames } from '../examples'
import { BookingList } from './booking-list'

const meta: Meta<typeof BookingList> = {
  title: 'Portal/Bookings/BookingList',
  component: BookingList,
  args: {
    title: 'これからの予約',
    rows,
    total: rows.length,
    more: 'none',
    onMore: fn(),
    bookingHref: ({ id }) => `/bookings/${id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every booking of the list is shown */
export const Complete: Story = {}

/** The list goes on */
export const WithMore: Story = {
  args: { total: 25, more: 'available' },
}

export const LoadingMore: Story = {
  args: { total: 25, more: 'loading' },
}

/** The bookings that come next were asked for and did not come */
export const MoreFailed: Story = {
  args: { total: 25, more: 'failed' },
}

/** The API did not say how many there are */
export const NotCounted: Story = {
  args: { total: null, more: 'available' },
}

/** A salon that is no longer there, and a service the salon no longer shows */
export const WithoutNames: Story = {
  args: {
    rows: [...rows.slice(0, 1), rowWithoutNames],
    total: 2,
  },
}

/** The visits that were */
export const Past: Story = {
  args: {
    title: 'これまでの予約',
    rows: rows.map((row, index) => ({
      ...row,
      booking: {
        ...row.booking,
        status: index === 1 ? 'no_show' : 'completed',
      },
    })),
  },
}

/** A salon and a service with long names */
export const WithLongNames: Story = {
  args: {
    rows: rows.slice(0, 1).map((row) => ({
      ...row,
      salon: {
        name: 'Hair&MakeStudioKomorebiOmotesandoAoyamaGaienmaeHarajukuShibuyaEbisuDaikanyamaNakameguroAnnex',
        timezone: 'Asia/Tokyo',
      },
      serviceName:
        'カット＋フルカラー＋トリートメント＋ヘッドスパ＋炭酸泉＋眉カット＋前髪パーマ＋ブロー（ロング料金、指名料込み）',
    })),
    total: 1,
  },
}
