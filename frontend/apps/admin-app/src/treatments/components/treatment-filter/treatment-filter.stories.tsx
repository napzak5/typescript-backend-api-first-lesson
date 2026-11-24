import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { salonScreenMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCustomer, salon, staff } from '../../../bookings/components/examples'
import { TreatmentFilter } from './treatment-filter'

const TREATMENTS = `/salons/${salon.id}/treatments`

const meta: Meta<typeof TreatmentFilter> = {
  title: 'Admin/Treatments/TreatmentFilter',
  component: TreatmentFilter,
  args: {
    conditions: {},
    staff,
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every record of the salon */
export const Every: Story = {}

/** The records of a member of the staff, written over some days */
export const Narrowed: Story = {
  args: {
    conditions: {
      staff: staff[1]?.id ?? '',
      from: '2026-11-01',
      to: '2026-11-20',
    },
    clearHref: TREATMENTS,
  },
}

/** The records of a customer, opened from the ledger */
export const OfCustomer: Story = {
  args: {
    conditions: { customer: aCustomer().id },
    customerName: adminCustomerMessages.naming.honored('山田 花子'),
    withoutCustomerHref: TREATMENTS,
    clearHref: TREATMENTS,
  },
}

/** A last day before the first */
export const WithErrors: Story = {
  args: {
    conditions: { from: '2026-11-20' },
    errors: {
      to: salonScreenMessages.period.endBeforeStart,
    },
    clearHref: TREATMENTS,
  },
}
