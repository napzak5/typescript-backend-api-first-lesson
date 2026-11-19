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
      firstName: '名を入力してください。',
      alternativePhone:
        '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
      birthDate:
        '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。',
      'preferences.preferredServices': '選択肢から選んでください。',
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

/** Long values, one of them without a place to break a line */
export const Wordy: Story = {
  args: { profile: wordyProfile },
}
