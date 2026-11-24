import { adminStaffAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { roleDescriptionFor } from '../../utils/account-format'
import { RoleForm } from './role-form'

const meta: Meta<typeof RoleForm> = {
  title: 'Admin/StaffAccounts/RoleForm',
  component: RoleForm,
  args: {
    roles: ['manager', 'staff'],
    description: roleDescriptionFor('owner'),
    submitLabel: '招待メールを送る',
    onSubmit: fn(),
    children: (
      <p>
        招待メールは、台帳のメールアドレス（misaki.tanaka@example.com）に送ります。
      </p>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The invitation an owner mails: no role is chosen until one is */
export const Invitation: Story = {}

/** The role of an account, as an administrator changes it: every role, the one the account has chosen */
export const RoleOfAnAccount: Story = {
  args: {
    roles: ['owner', 'manager', 'staff'],
    role: 'manager',
    description: roleDescriptionFor('admin'),
    submitLabel: 'ロールを変える',
    children: undefined,
  },
}

/** Sent without a role */
export const WithoutARole: Story = {
  args: { errors: { role: adminStaffAccountMessages.roles.missing } },
}

/** An invitation mailed less than a minute before */
export const MailedMomentsAgo: Story = {
  args: { message: adminStaffAccountMessages.invite.recent('田中 美咲') },
}
