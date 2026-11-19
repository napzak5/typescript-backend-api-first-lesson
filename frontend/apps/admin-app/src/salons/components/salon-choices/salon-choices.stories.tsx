import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { SalonChoices } from './salon-choices'

const meta: Meta<typeof SalonChoices> = {
  title: 'Admin/Salons/SalonChoices',
  component: SalonChoices,
  args: {
    salons: [
      salon,
      {
        ...salon,
        id: '4c9f3a5b-7d2e-4fac-9b80-3e6d0f2c5b71',
        name: 'Salon Hikari 銀座店',
        city: '中央区',
        address: '銀座 5-2-1',
        building: '銀座ビル 3F',
        isActive: false,
      },
    ],
    total: 2,
    more: 'none',
    onMore: fn(),
    salonHref: ({ id }) => `/salons/${id}/bookings`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every salon is shown, one of them taking no bookings */
export const Salons: Story = {}

/** More salons can be asked for */
export const WithMore: Story = {
  args: { total: 24, more: 'available' },
}
