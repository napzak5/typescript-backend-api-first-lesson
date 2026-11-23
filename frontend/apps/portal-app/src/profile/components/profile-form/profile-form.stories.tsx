import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import { fieldMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { profile, TODAY, wordyProfile } from '../examples'
import { ProfileForm } from './profile-form'

const meta: Meta<typeof ProfileForm> = {
  title: 'Portal/Profile/ProfileForm',
  component: ProfileForm,
  args: {
    profile,
    today: TODAY,
    submitLabel: '変更を保存する',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The profile there is, to be changed */
export const Filled: Story = {}

/** An account without a profile: what the form is sent with makes one */
export const Empty: Story = {
  args: { profile: null, submitLabel: '登録する' },
}

/** What is wrong is said at its control; the first of them has the focus */
export const WithErrors: Story = {
  args: {
    errors: {
      firstName: fieldMessages.firstNameMissing,
      alternativePhone: fieldMessages.phoneMalformed,
      birthDate: fieldMessages.birthDateOutOfRange,
      'preferences.preferredServices': fieldMessages.unlisted,
    },
  },
}

/** Nothing came of the attempt, and no control is to blame */
export const WithMessage: Story = {
  args: {
    message: NOT_SENT_MESSAGE,
  },
}

export const Pending: Story = {
  args: { pending: true },
}

/** Long values, one of them without a place to break a line */
export const Wordy: Story = {
  args: { profile: wordyProfile },
}
