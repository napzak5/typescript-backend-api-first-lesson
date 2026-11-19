import type { Meta, StoryObj } from '@storybook/react-vite'
import { ButtonLink } from '../button-link/button-link'
import { PageHeader } from './page-header'

const meta: Meta<typeof PageHeader> = {
  title: 'Components/PageHeader',
  component: PageHeader,
  args: {
    title: '予約台帳',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const TitleOnly: Story = {}

export const WithDescription: Story = {
  args: { description: '今日の予約は 12 件です。' },
}

export const WithActions: Story = {
  args: {
    description: '今日の予約は 12 件です。',
    actions: (
      <ButtonLink href='/bookings/new' variant='primary'>
        新しい予約
      </ButtonLink>
    ),
  },
}
