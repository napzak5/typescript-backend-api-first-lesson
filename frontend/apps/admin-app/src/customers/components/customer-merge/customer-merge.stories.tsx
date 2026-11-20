import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCustomer, salon } from '../../../bookings/components/examples'
import { CustomerMerge } from './customer-merge'

const hanako = aCustomer({
  phoneNumber: '090-1234-5678',
  loyaltyPoints: 1200,
  tags: ['vip'],
  updatedAt: '2026-01-10T00:00:00.000Z',
})

/** The same person, registered again by phone: other kana, another address of mail, a referrer, a later change */
const hanakoAgain = aCustomer({
  id: '0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b',
  firstNameKana: null,
  lastNameKana: null,
  email: 'hanako.yamada@example.com',
  occupation: '会社員',
  loyaltyPoints: 300,
  referredBy: 'd2a0e5b8-7f9d-4b1e-a3c5-1e8f4a7b9cd6',
  updatedAt: '2026-03-01T00:00:00.000Z',
})

const meta: Meta<typeof CustomerMerge> = {
  title: 'Admin/Customers/CustomerMerge',
  component: CustomerMerge,
  parameters: {
    // The dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '40rem' } },
  },
  args: {
    customer: hanako,
    other: hanakoAgain,
    thisKept: true,
    onKeep: fn(),
    way: 'keep_primary',
    onWay: fn(),
    obstacles: [],
    customerHref: (customerId) => `/salons/${salon.id}/customers/${customerId}`,
    open: false,
    onOpen: fn(),
    onClose: fn(),
    onMerge: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The customer of the address is kept: the items the two differ in, with what the merge makes of them */
export const KeepingThisOne: Story = {}

/** The other is kept, and the newest value taken where both have one */
export const KeepingTheOther: Story = {
  args: { thisKept: false, way: 'keep_newest' },
}

/** The two differ in nothing the ledger shows */
export const Alike: Story = {
  args: { other: { ...hanako, id: hanakoAgain.id } },
}

/** What the API would refuse is said, and there is no button */
export const InTheWay: Story = {
  args: {
    obstacles: [
      { type: 'accounts' },
      { type: 'erasureAsked', who: '山田 花子 様（hanako@example.com）' },
    ],
  },
}

/** The API refused, and the two were read again: said above the choices */
export const Refused: Story = {
  args: {
    refusal:
      'その間に 2 人の記録が変わったため、まとめられませんでした。2 人の記録を読み直しました。',
  },
}

/** The dialog asks before the two are merged */
export const Asking: Story = {
  args: { open: true },
}

/** The merge is on its way */
export const Merging: Story = {
  args: { open: true, pending: true },
}

/** The merge was not sent: said in the dialog, which stays open */
export const NotSent: Story = {
  args: {
    open: true,
    message:
      'お客様をまとめられませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
