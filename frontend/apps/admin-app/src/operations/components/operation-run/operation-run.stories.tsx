import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import {
  ADMINISTRATORS_ONLY,
  ERASURE_COPY,
  EXPIRY_COPY,
  erasureResultOf,
  expiryResultOf,
  PURGE_COPY,
  ranAtOf,
} from '../../utils/operations'
import { aDeletionRequest, TIMEZONE } from '../examples'
import { ExecutedRequests } from '../executed-requests/executed-requests'
import { OperationRun } from './operation-run'

const meta: Meta<typeof OperationRun> = {
  title: 'Admin/Operations/OperationRun',
  component: OperationRun,
  args: {
    copy: EXPIRY_COPY,
    onAsk: fn(),
    onClose: fn(),
    onRun: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

const REQUESTS = [
  aDeletionRequest(),
  aDeletionRequest({
    id: '6e7f8091-a2b3-4c4d-8e5f-6a7b8c9d0e1f',
    reason:
      'アカウントを削除したので、台帳からも消してほしいとメールで依頼があった',
    requestedAt: '2026-11-06T05:10:00.000Z',
    scheduledAt: '2026-11-20T05:10:00.000Z',
  }),
]

/** What the expiry of the points does, and its button */
export const Offered: Story = {}

/** The dialog asks before the points are expired */
export const Asking: Story = {
  args: { asking: true },
}

/** The expiry is on its way */
export const Pending: Story = {
  args: { asking: true, pending: true },
}

/** The last attempt may have stopped halfway */
export const Failed: Story = {
  args: {
    asking: true,
    message:
      'ポイントの失効を終えられませんでした。途中で止まったときも、それまでの分は失効させてあります。通信の状態を確かめて、もう一度実行すると、残りを失効させます。',
  },
}

/** The account is not an administrator's */
export const Forbidden: Story = {
  args: { refusal: ADMINISTRATORS_ONLY },
}

/** The expiry ran, and said what it did */
export const Expired: Story = {
  args: {
    result: ranAtOf(
      '2026年11月20日（金） 12:00',
      expiryResultOf({ processedCount: 3, totalPoints: 1250 }),
    ),
  },
}

/** The deletion requests that were due were carried out, and are listed */
export const Erased: Story = {
  args: {
    copy: ERASURE_COPY,
    result: ranAtOf('2026年11月20日（金） 12:00', erasureResultOf(REQUESTS)),
    children: <ExecutedRequests requests={REQUESTS} timezone={TIMEZONE} />,
  },
}

/** The removal of the attachments that are no longer needed, and its button */
export const Purge: Story = {
  args: { copy: PURGE_COPY },
}
