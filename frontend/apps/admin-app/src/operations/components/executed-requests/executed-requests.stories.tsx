import type { Meta, StoryObj } from '@storybook/react-vite'
import { aDeletionRequest, TIMEZONE } from '../examples'
import { ExecutedRequests } from './executed-requests'

const meta: Meta<typeof ExecutedRequests> = {
  title: 'Admin/Operations/ExecutedRequests',
  component: ExecutedRequests,
  args: { timezone: TIMEZONE },
}

export default meta

type Story = StoryObj<typeof meta>

/** The requests a run carried out, one with a reason of more than one line */
export const Carried: Story = {
  args: {
    requests: [
      aDeletionRequest(),
      aDeletionRequest({
        id: '6e7f8091-a2b3-4c4d-8e5f-6a7b8c9d0e1f',
        reason:
          '本人が来店して依頼した。\n本人であることは、運転免許証で確かめた。',
        requestedAt: '2026-11-06T05:10:00.000Z',
        scheduledAt: '2026-11-20T05:10:00.000Z',
      }),
    ],
  },
}
