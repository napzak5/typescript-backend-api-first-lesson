import type { Meta, StoryObj } from '@storybook/react-vite'
import { Note } from './note'

const meta: Meta<typeof Note> = {
  title: 'Components/Note',
  component: Note,
  args: {
    children: '直近 90 日の予約を、新しいものから表示しています。',
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What is said of a screen, a part or a list */
export const Default: Story = {}

/** What supports a control or a part of a form */
export const Small: Story = {
  args: {
    size: 'small',
    children: '曜日ごとに、開店と閉店の時刻を入れてください。',
  },
}
