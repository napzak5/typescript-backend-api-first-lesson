import type { Meta, StoryObj } from '@storybook/react-vite'
import { aCustomer } from '../examples'
import { ChosenCustomer } from './chosen-customer'

const meta: Meta<typeof ChosenCustomer> = {
  title: 'Admin/Bookings/ChosenCustomer',
  component: ChosenCustomer,
  args: {
    customer: aCustomer(),
    againHref: '?date=2026-11-20&search=%E5%B1%B1%E7%94%B0',
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The customer a booking is put in for */
export const Customer: Story = {}

/** A customer who gave no kana */
export const WithoutKana: Story = {
  args: { customer: aCustomer({ lastNameKana: null, firstNameKana: null }) },
}
