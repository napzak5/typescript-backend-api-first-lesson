import type { Meta, StoryObj } from '@storybook/react-vite'
import { LoadingIndicator } from './loading-indicator'

const meta: Meta<typeof LoadingIndicator> = {
  title: 'Components/LoadingIndicator',
  component: LoadingIndicator,
  args: { label: '空き時間を確認しています' },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
