import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './badge'

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  args: {
    children: '仮予約',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Neutral: Story = {}

export const Info: Story = {
  args: { tone: 'info', children: '来店中' },
}

export const Success: Story = {
  args: { tone: 'success', children: '確定' },
}

export const Warning: Story = {
  args: { tone: 'warning', children: '残りわずか' },
}

export const Danger: Story = {
  args: { tone: 'danger', children: 'キャンセル' },
}
