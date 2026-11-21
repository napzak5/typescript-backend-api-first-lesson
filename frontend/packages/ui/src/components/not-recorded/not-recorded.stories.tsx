import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotRecorded } from './not-recorded'

const meta: Meta<typeof NotRecorded> = {
  title: 'Components/NotRecorded',
  component: NotRecorded,
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
