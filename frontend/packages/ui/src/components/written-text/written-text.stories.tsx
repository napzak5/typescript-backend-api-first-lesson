import type { Meta, StoryObj } from '@storybook/react-vite'
import { WrittenText } from './written-text'

const meta: Meta<typeof WrittenText> = {
  title: 'Components/WrittenText',
  component: WrittenText,
  args: {
    children: '前回と同じ長さでお願いします。\n\n前髪は  眉にかかるくらいに。',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
