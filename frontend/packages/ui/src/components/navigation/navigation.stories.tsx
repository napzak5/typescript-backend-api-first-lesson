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

export const NoCurrentScreen: Story = {
  args: {
    items: [
      { href: '/salons', label: 'サロンを探す' },
      { href: '/bookings', label: '予約' },
      { href: '/account', label: 'マイページ' },
    ],
  },
}
