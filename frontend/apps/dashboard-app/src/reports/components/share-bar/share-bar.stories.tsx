import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShareBar } from './share-bar'

const meta: Meta<typeof ShareBar> = {
  title: 'Dashboard/Reports/ShareBar',
  component: ShareBar,
  args: { percent: 50, children: '￥12,100' },
}

export default meta

type Story = StoryObj<typeof meta>

/** Half of the most */
export const Half: Story = {}

/** The most, the whole length */
export const Whole: Story = { args: { percent: 100, children: '￥23,100' } }

/** Nothing */
export const Nothing: Story = { args: { percent: 0, children: '￥0' } }
