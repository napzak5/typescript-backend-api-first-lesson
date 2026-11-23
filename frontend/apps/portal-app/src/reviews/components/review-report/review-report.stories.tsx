import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import { dayOf } from '@beauty-salon-shared/i18n/formats'
import {
  portalReviewMessages,
  portalSalonMessages,
} from '@beauty-salon-shared/i18n/messages/portal'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn, userEvent } from 'storybook/test'
import { ReviewReport, type ReviewReportProps } from './review-report'

const meta: Meta<typeof ReviewReport> = {
  title: 'Portal/Reviews/ReviewReport',
  component: ReviewReport,
  args: {
    open: true,
    subject: portalSalonMessages.reviews.posted(
      '思ったとおりの色になりました',
      dayOf('2026-11-10'),
    ),
    onClose: fn(),
    onReport: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What a screen says about a form that was sent */
type Answer = Pick<ReviewReportProps, 'errors' | 'reportedBefore'>

type AnsweringProps = ReviewReportProps & { answer: Answer }

/**
 * The dialog as a screen works it: what there is to say about an attempt
 * is said when the form was sent, into a dialog that is open.
 */
const Answering = ({ answer, onReport, ...props }: AnsweringProps) => {
  const [said, setSaid] = useState<Answer>({})

  return (
    <ReviewReport
      {...props}
      {...said}
      onReport={(values) => {
        onReport(values)
        setSaid(answer)
      }}
    />
  )
}

/** Sends the form as it is */
const send: NonNullable<Story['play']> = async ({ canvas }) => {
  await userEvent.click(canvas.getByRole('button', { name: '通報する' }))
}

/** The dialog asks why */
export const Asking: Story = {}

/** The report is on its way */
export const Pending: Story = {
  args: { pending: true },
}

/** Nothing came of the attempt, which can be made again */
export const WithMessage: Story = {
  args: {
    message: NOT_SENT_MESSAGE,
  },
}

/** The form was sent without a reason: the focus is on the first of them */
export const WithoutReason: Story = {
  render: (args) => (
    <Answering
      {...args}
      answer={{ errors: { reason: portalReviewMessages.report.reasonMissing } }}
    />
  ),
  play: send,
}

/**
 * A reason the list does not name was chosen, and nothing was said about
 * it: the focus is on the control that says what
 */
export const WithoutDetails: Story = {
  render: (args) => (
    <Answering
      {...args}
      answer={{
        errors: {
          details: portalReviewMessages.report.detailsMissing,
        },
      }}
    />
  ),
  play: send,
}

/**
 * The account reported the review before: there is nothing to send, and
 * the focus is on the way out
 */
export const ReportedBefore: Story = {
  render: (args) => <Answering {...args} answer={{ reportedBefore: true }} />,
  play: send,
}

export const Closed: Story = {
  args: { open: false },
}
