import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aProfile } from '../examples'
import { ProfileForm } from './profile-form'

const meta: Meta<typeof ProfileForm> = {
  title: 'Admin/OwnProfile/ProfileForm',
  component: ProfileForm,
  args: { profile: aProfile(), onSubmit: fn() },
}

export default meta

type Story = StoryObj<typeof meta>

/** The profile as it is now */
export const AsItIs: Story = {}

/** What was refused, at the controls */
export const WithErrors: Story = {
  args: {
    errors: {
      imageUrl:
        'http:// か https:// で始まる URL を、500 文字までで入力してください。',
    },
  },
}

/** What went wrong with the attempt, above the controls */
export const Failed: Story = {
  args: {
    message:
      'プロフィールを保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}

/** The attempt is on its way */
export const Pending: Story = {
  args: { pending: true },
}
