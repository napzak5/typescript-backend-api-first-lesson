import type { Meta, StoryObj } from '@storybook/react-vite'
import { VisuallyHidden } from './visually-hidden'

const meta: Meta<typeof VisuallyHidden> = {
  title: 'Components/VisuallyHidden',
  component: VisuallyHidden,
  args: {
    children: 'hanako@example.com',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
