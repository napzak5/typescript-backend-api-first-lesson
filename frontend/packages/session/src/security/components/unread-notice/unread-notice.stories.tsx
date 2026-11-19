import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { UnreadNotice } from './unread-notice'

const meta: Meta<typeof UnreadNotice> = {
  title: 'Session/Security/UnreadNotice',
  component: UnreadNotice,
  args: {
    what: 'サインインしている端末',
    reason: { type: 'failed' },
    onRetry: fn(),
    retrying: false,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** No answer, or one that says nothing */
export const Failed: Story = {}

export const TooManyRequests: Story = {
  args: { reason: { type: 'tooManyRequests' } },
}

/** The API is being asked again */
export const Retrying: Story = {
  args: { retrying: true },
}
