import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { customers, salon } from '../../../bookings/components/examples'
import { answeredReview, reportedReview } from '../examples'
import { ReviewRecord } from './review-record'

const SALON = `/salons/${salon.id}`

const meta: Meta<typeof ReviewRecord> = {
  title: 'Admin/Reviews/ReviewRecord',
  component: ReviewRecord,
  args: {
    review: answeredReview,
    timezone: salon.timezone,
    author: {
      type: 'found',
      name: '山田 花子',
      href: `${SALON}/customers/${customers[0]?.id}`,
    },
    staffName: adminStaffMessages.named('田中 美咲'),
    bookingHref: `${SALON}/bookings/${answeredReview.bookingId}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A review of every side of the visit, with a picture, which three found helpful */
export const Rated: Story = {}

/** A review without a title that names nobody, rates some sides only, was changed and waits for the platform */
export const Reported: Story = {
  args: {
    review: reportedReview,
    author: {
      type: 'found',
      name: '鈴木 一郎',
      href: `${SALON}/customers/${customers[1]?.id}`,
    },
    staffName: undefined,
    bookingHref: `${SALON}/bookings/${reportedReview.bookingId}`,
  },
}

/** The customer was removed from the ledger, and the staff are read */
export const AuthorGone: Story = {
  args: { author: { type: 'gone' }, staffName: undefined },
}

/** The customer could not be read */
export const AuthorUnread: Story = {
  args: { author: { type: 'unread' } },
}
