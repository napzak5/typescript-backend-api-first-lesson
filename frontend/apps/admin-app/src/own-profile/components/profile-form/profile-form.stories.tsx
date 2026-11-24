import { WEB_ADDRESS_ERROR } from '@beauty-salon-frontend/fields'
import { adminProfileMessages } from '@beauty-salon-shared/i18n/messages/admin'
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
    errors: { imageUrl: WEB_ADDRESS_ERROR },
  },
}

/** What went wrong with the attempt, above the controls */
export const Failed: Story = {
  args: {
    message: adminProfileMessages.form.failed,
  },
}

/** The attempt is on its way */
export const Pending: Story = {
  args: { pending: true },
}
