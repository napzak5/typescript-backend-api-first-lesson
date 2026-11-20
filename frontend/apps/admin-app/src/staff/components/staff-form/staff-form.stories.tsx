import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aStaffMember } from '../examples'
import { StaffForm } from './staff-form'

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
      staffCode:
        'このスタッフコードは、ほかのスタッフが使っています（台帳から削除したスタッフも含みます）。別のコードを入力してください。',
      isActive:
        'ご自身のスタッフ情報は、無効にできません。無効にすると、このアカウントでサロンの画面を使えなくなります。',
    },
  },
}

/** The attempt is on its way */
export const Pending: Story = {
  args: { pending: true },
}
