import type { Meta, StoryObj } from '@storybook/react-vite'
import { staff } from '../../../bookings/components/examples'
import { CustomerPreferences } from './customer-preferences'

const [misaki, ken] = staff

const meta: Meta<typeof CustomerPreferences> = {
  title: 'Admin/Customers/CustomerPreferences',
  component: CustomerPreferences,
  args: {
    preferences: {
      preferredStaffId: null,
      avoidStaffIds: [],
      preferredTimeSlots: [],
      stylePreferences: null,
      communicationStyle: null,
      specialRequests: null,
    },
    staff: new Map(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A customer who set nothing */
export const Unset: Story = {}

/** Everything set, with a member who is no longer shown among those to avoid */
export const Everything: Story = {
  args: {
    preferences: {
      preferredStaffId: misaki?.id ?? null,
      avoidStaffIds: [ken?.id ?? '', 'f0e1d2c3-b4a5-4968-8776-655443322110'],
      preferredTimeSlots: [
        { startTime: '10:00', endTime: '12:00' },
        { startTime: '18:00', endTime: '20:00' },
      ],
      stylePreferences: {
        preferredLength: 'ボブ',
        preferredColors: ['アッシュ', 'ベージュ'],
        avoidStyles: ['刈り上げ'],
        inspirationImages: [
          'https://example.com/styles/bob.jpg',
          'https://example.com/styles/ash.jpg',
        ],
      },
      communicationStyle: '静かに過ごしたい',
      specialRequests:
        '香りの強い製品は苦手です。\n首が弱いので、シャンプー台はゆっくり倒してください。',
    },
    staff: new Map(
      [misaki, ken].flatMap((member) =>
        member === undefined ? [] : [[member.id, member]],
      ),
    ),
  },
}
