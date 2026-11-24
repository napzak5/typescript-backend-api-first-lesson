import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { adminReviewReportMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { REPORTS } from '../examples'
import { ReportTable } from '../report-table/report-table'
import { ReviewReports } from './review-reports'

const { dismissal } = adminReviewReportMessages

/** When the report the dialog asks of was received: 「2026年11月20日（金） 10:30」 */
const RECEIVED = momentNameAt('2026-11-20T01:30:00.000Z', salon.timezone)

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
  args: { asking: RECEIVED },
}

/** The last attempt did not reach the API */
export const Failed: Story = {
  args: {
    asking: RECEIVED,
    message: dismissal.failed,
  },
}

/** Another administrator dismissed the report meanwhile */
export const DismissedMeanwhile: Story = {
  args: {
    refusal: dismissal.already,
  },
}
