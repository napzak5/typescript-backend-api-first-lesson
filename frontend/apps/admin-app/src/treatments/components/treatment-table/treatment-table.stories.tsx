import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import {
  aCustomer,
  salon,
  services,
  staff,
} from '../../../bookings/components/examples'
import { aTreatment } from '../examples'
import { TreatmentTable } from './treatment-table'

export const ROWS = [
  { record: aTreatment(), customer: aCustomer() },
  {
    record: aTreatment({
      id: '19b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5e',
      staffId: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      services: ['0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e'],
      processingTime: null,
      customerSatisfaction: null,
      createdAt: '2026-11-18T08:15:00.000Z',
    }),
    customer: undefined,
  },
]

const meta: Meta<typeof TreatmentTable> = {
  title: 'Admin/Treatments/TreatmentTable',
  component: TreatmentTable,
  args: {
    caption: '施術記録',
    rows: ROWS,
    total: 2,
    more: 'none',
    onMore: fn(),
    timezone: salon.timezone,
    staff,
    services,
    treatmentHref: (id) => `/salons/${salon.id}/treatments/${id}`,
    customerHref: (id) => `/salons/${salon.id}/customers/${id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A record of the customer of the examples, and one of a customer who left the ledger, with what was not recorded */
export const Found: Story = {}

/** More records can be asked for */
export const WithMore: Story = {
  args: { total: 48, more: 'available' },
}

/** Nothing meets the conditions */
export const Empty: Story = {
  args: { caption: '条件に合う施術記録', rows: [], total: 0 },
}
