import { adminReviewReportMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { REPORTS, waitingReport } from '../examples'
import { ReportTable } from '../report-table/report-table'
import { ReviewReports } from './review-reports'

const { dismissal } = adminReviewReportMessages

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
    timezone: salon.timezone,
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

/** The dialog asks before a report received at 10:30 is dismissed */
export const Asking: Story = {
  args: { asking: waitingReport },
}

/** The last attempt did not reach the API */
export const Failed: Story = {
  args: {
    asking: waitingReport,
    message: dismissal.failed,
  },
}

/** Another administrator dismissed the report meanwhile */
export const DismissedMeanwhile: Story = {
  args: {
    refusal: dismissal.already,
  },
}
