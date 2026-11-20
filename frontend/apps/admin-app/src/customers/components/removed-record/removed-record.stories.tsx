import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCustomer, salon } from '../../../bookings/components/examples'
import { aVersion } from '../examples'
import { RemovedRecord } from './removed-record'

const customers = `/salons/${salon.id}/customers`

const meta: Meta<typeof RemovedRecord> = {
  title: 'Admin/Customers/RemovedRecord',
  component: RemovedRecord,
  args: {
    version: aVersion({ version: 5, operation: 'delete' }),
    removal: 'deleted',
    changer: 'あなた',
    timezone: salon.timezone,
    historyHref: `${customers}/${aCustomer().id}/history`,
    customerHref: (customerId) => `${customers}/${customerId}`,
    onRestore: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A customer who was removed, and can be brought back */
export const Deleted: Story = {}

/** A customer who was referred by another */
export const Referred: Story = {
  args: {
    version: aVersion({
      version: 5,
      operation: 'delete',
      referredBy: 'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
    }),
  },
}

/** The customer is being brought back */
export const Restoring: Story = {
  args: { pending: true },
}

/** Another customer has the address of mail: said, with the way to them */
export const EmailTaken: Story = {
  args: {
    refusal: {
      message:
        'このお客様のメールアドレス（hanako.yamada@example.com）は、削除のあとに登録されたお客様が使っています。そのお客様のメールアドレスを変えてから、台帳に戻してください。',
      link: {
        href: `${customers}?search=hanako.yamada%40example.com`,
        label: 'そのお客様を台帳で探す',
      },
    },
  },
}

/** A customer who was merged into another cannot come back */
export const Merged: Story = {
  args: {
    version: aVersion({ version: 5, operation: 'merge' }),
    removal: 'merged',
    changer: 'ほかのアカウント',
  },
}

/** A customer whose data was erased at their request cannot come back */
export const Erased: Story = {
  args: {
    version: aVersion({
      version: 1,
      operation: 'erase',
      firstName: '顧客',
      lastName: '消去済み',
      firstNameKana: null,
      lastNameKana: null,
      email: 'b08e3c6f-5d7b-4fce-9cad-9b6d2e5f7ab4@erased.invalid',
      phoneNumber: '0000000000',
      tags: [],
    }),
    removal: 'erased',
    changer: 'ほかのアカウント',
  },
}
