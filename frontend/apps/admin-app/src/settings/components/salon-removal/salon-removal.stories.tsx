import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SalonRemoval } from './salon-removal'

const NAME = 'Salon Hikari 表参道店'

const { removal } = adminSettingsMessages

const meta: Meta<typeof SalonRemoval> = {
  title: 'Admin/Settings/SalonRemoval',
  component: SalonRemoval,
  args: {
    name: NAME,
    refusal: undefined,
    bookingsHref: '/salons/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01/bookings',
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What the removal does, and the button that asks */
export const Offered: Story = {}

/** Refused for bookings that are not finished: said with the way to them */
export const BookingsUnfinished: Story = {
  args: {
    refusal: {
      type: 'bookingsUnfinished',
      message: removal.bookingsUnfinished(NAME),
    },
  },
}

/** Refused to an account that no longer removes the salon */
export const Forbidden: Story = {
  args: {
    refusal: {
      type: 'forbidden',
      message: removal.forbidden,
    },
  },
}
