import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { REPORTS } from '../examples'
import { ReportTable } from '../report-table/report-table'
import { ReviewReports } from './review-reports'

const meta: Meta<typeof ReviewReports> = {
  title: 'Admin/ReviewReports/ReviewReports',
  component: ReviewReports,
  args: {
    children: (
      <ReportTable
        caption='このレビューへの通報'
        reports={REPORTS}
        timezone={salon.timezone}
        onDismiss={fn()}
        total={3}
        more='none'
        onMore={fn()}
      />
    ),
    onClose: fn(),
    onDismiss: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The reports of a review, those that wait with their buttons */
export const Reports: Story = {}

/** The review has no report */
export const NoReports: Story = {
  args: { children: <p>このレビューへの通報はありません。</p> },
}

/** The dialog asks before a report is dismissed */
export const Asking: Story = {
  args: { asking: '2026年11月20日（金） 10:30' },
}

/** The last attempt did not reach the API */
export const Failed: Story = {
  args: {
    asking: '2026年11月20日（金） 10:30',
    message:
      '通報を却下できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

/** Another administrator dismissed the report meanwhile */
export const DismissedMeanwhile: Story = {
  args: {
    refusal:
      'この通報は、その間に、ほかの管理者が却下しました。却下は、1 つの通報に 1 回です。',
  },
}
