import type { Meta, StoryObj } from '@storybook/react-vite'
import { Navigation } from './navigation'

const meta: Meta<typeof Navigation> = {
  title: 'Components/Navigation',
  component: Navigation,
  args: {
    label: 'メインメニュー',
    items: [
      { href: '/bookings', label: '予約台帳', current: true },
      { href: '/sales', label: '会計' },
      { href: '/customers', label: '顧客台帳' },
      { href: '/staff', label: 'スタッフ' },
    ],
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Horizontal: Story = {}

export const Vertical: Story = {
  args: { orientation: 'vertical' },
}

/**
 * More links than the row has room for, the current one far along it: the
 * row scrolls, by itself, so that the current link is in its middle.
 */
export const CurrentFarAlong: Story = {
  args: {
    items: [
      { href: '/bookings', label: '予約' },
      { href: '/sales', label: '売上' },
      { href: '/customers', label: '顧客' },
      { href: '/reviews', label: 'レビュー' },
      { href: '/attachments', label: 'ファイル' },
      { href: '/treatments', label: '施術記録' },
      { href: '/shifts', label: 'シフト' },
      { href: '/menu', label: 'メニュー' },
      { href: '/products', label: '商品', current: true },
      { href: '/inventory', label: '在庫' },
      { href: '/purchase-orders', label: '発注' },
      { href: '/settings', label: '設定' },
    ],
  },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
}

export const NoCurrentScreen: Story = {
  args: {
    items: [
      { href: '/salons', label: 'サロンを探す' },
      { href: '/bookings', label: '予約' },
      { href: '/account', label: 'マイページ' },
    ],
  },
}
