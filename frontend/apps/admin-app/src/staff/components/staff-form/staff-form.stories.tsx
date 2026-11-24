import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aStaffMember } from '../examples'
import { StaffForm } from './staff-form'

const { form } = adminStaffMessages

const meta: Meta<typeof StaffForm> = {
  title: 'Admin/Staff/StaffForm',
  component: StaffForm,
  args: {
    member: null,
    submitLabel: '登録する',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A new member: active, taking one booking at a time, with no time kept around it */
export const Entry: Story = {}

/** A member of whom everything is recorded, to change */
export const Change: Story = {
  args: { member: aStaffMember(), submitLabel: '変更を保存する' },
}

/** What the API refused, at the controls */
export const WithErrors: Story = {
  args: {
    ...Change.args,
    errors: {
      staffCode: form.errors.staffCodeTaken,
      isActive: form.errors.ownRecordStaysActive,
    },
  },
}

/** What the API refused of the attempt as a whole */
export const Refused: Story = {
  args: { ...Change.args, message: form.forbidden },
}

/** The attempt is on its way */
export const Pending: Story = {
  args: { pending: true },
}
