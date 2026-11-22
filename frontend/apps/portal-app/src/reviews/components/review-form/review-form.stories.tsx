import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { enteredForVisit, enteredOf } from '../../utils/review-flow'
import { plainReview, ratedReview, reviewers, visit } from '../examples'
import { ReviewForm } from './review-form'

const meta: Meta<typeof ReviewForm> = {
  title: 'Portal/Reviews/ReviewForm',
  component: ReviewForm,
  args: {
    entered: enteredForVisit(visit),
    staff: { type: 'choice', options: reviewers },
    submitLabel: 'レビューを投稿する',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A visit that nobody has written about: the member of the staff the booking was with is chosen */
export const New: Story = {}

/** A visit whose staff the salon no longer shows: there is nobody to rate */
export const NewWithoutStaff: Story = {
  args: {
    entered: enteredForVisit({ ...visit, staff: [] }),
    staff: { type: 'choice', options: [] },
  },
}

/** A review that is changed: whom it rates is said, and cannot be chosen */
export const Written: Story = {
  args: {
    entered: enteredOf(ratedReview),
    staff: { type: 'fixed', name: '田中 ひろし' },
    submitLabel: '変更を保存する',
  },
}

/** A review of a member of the staff their salon no longer shows */
export const WrittenOfStaffThatLeft: Story = {
  args: {
    entered: enteredOf(ratedReview),
    staff: { type: 'fixed', name: null },
    submitLabel: '変更を保存する',
  },
}

/** A review that rates nobody: it has no rating of the staff, and gets none */
export const WrittenOfNobody: Story = {
  args: {
    entered: enteredOf(plainReview),
    staff: { type: 'nobody' },
    submitLabel: '変更を保存する',
  },
}

/** What is wrong is said at its control; the first of them has the focus */
export const WithErrors: Story = {
  args: {
    errors: {
      overallRating: '総合の評価を選んでください。',
      title: '255 文字以内で入力してください。',
      imageUrls:
        '2 行目を確かめてください。http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
    },
  },
}

/** Nothing came of the attempt, and no control is to blame */
export const WithMessage: Story = {
  args: {
    message:
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

export const Pending: Story = {
  args: { pending: true },
}
