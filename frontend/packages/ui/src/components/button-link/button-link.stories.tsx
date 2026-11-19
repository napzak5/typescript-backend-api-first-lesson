import type { Meta, StoryObj } from '@storybook/react-vite'
import { ButtonLink } from './button-link'

const meta: Meta<typeof ButtonLink> = {
  title: 'Components/ButtonLink',
  component: ButtonLink,
  args: {
    href: '/bookings/new',
    children: '新しい予約',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Secondary: Story = {}

export const Primary: Story = {
  args: { variant: 'primary' },
}

export const Quiet: Story = {
  args: { variant: 'quiet', href: '/bookings', children: '一覧へ戻る' },
}

export const Small: Story = {
  args: { size: 'small' },
}
