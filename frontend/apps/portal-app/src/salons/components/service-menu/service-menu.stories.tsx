import type { Meta, StoryObj } from '@storybook/react-vite'
import { menuOf } from '../../salon-menu'
import { categories, services } from '../examples'
import { ServiceMenu } from './service-menu'

const meta: Meta<typeof ServiceMenu> = {
  title: 'Portal/Salons/ServiceMenu',
  component: ServiceMenu,
  args: {
    groups: menuOf(categories, services),
    currency: 'JPY',
    bookingHref: ({ salonId, id }) =>
      `/salons/${salonId}/services/${id}/booking`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/**
 * Two categories and a service without one: a fixed price, a discount, a
 * price that rises with what is done, and one that is agreed on
 */
export const Default: Story = {}

export const OneCategory: Story = {
  args: { groups: menuOf(categories.slice(0, 1), services.slice(0, 2)) },
}

/** The menu of a salon that takes no bookings: nothing leads to a booking */
export const NotTakingBookings: Story = {
  args: { bookingHref: undefined },
}
