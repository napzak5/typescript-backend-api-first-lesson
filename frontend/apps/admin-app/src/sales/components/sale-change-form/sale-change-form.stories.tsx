import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aSale, salon, staff } from '../examples'

import { SaleChangeForm } from './sale-change-form'

const { errors } = adminSaleMessages.changes.change

const meta: Meta<typeof SaleChangeForm> = {
  title: 'Admin/Sales/SaleChangeForm',
  component: SaleChangeForm,
  args: {
    sale: aSale({ notes: '次回はカラーの相談' }),
    staff,
    timezone: salon.timezone,
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A sale taken by a member of the staff, with a note */
export const Taken: Story = {}

/** A sale that records nobody as having taken it, and no note */
export const NobodyRecorded: Story = {
  args: { sale: aSale({ staffId: null }) },
}

/** A sale taken by somebody who is among the staff no more */
export const TakenByUnlisted: Story = {
  args: {
    sale: aSale({ staffId: '9e6c1a4d-3b5f-4dac-9a8e-7f4b0c3d5e92' }),
  },
}

/** What the form found wrong, or the API refused */
export const WithErrors: Story = {
  args: {
    errors: { staffId: errors.staffGone, saleTime: errors.later },
  },
}
