import { Button, ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  aBooking,
  aCustomer,
  salon,
  services,
  staff,
} from '../../../bookings/components/examples'
import { aTreatment, products } from '../examples'
import { TreatmentRecord } from './treatment-record'

const meta: Meta<typeof TreatmentRecord> = {
  title: 'Admin/Treatments/TreatmentRecord',
  component: TreatmentRecord,
  args: {
    record: aTreatment(),
    timezone: salon.timezone,
    bookingName: 'BK-4F7H-2KQM（2026年11月20日（金））',
    bookingHref: `/salons/${salon.id}/bookings/${aBooking().id}`,
    customer: aCustomer(),
    customerHref: `/salons/${salon.id}/customers/${aCustomer().id}`,
    staff,
    services,
    products,
    actions: (
      <>
        <ButtonLink href='/'>施術記録を直す</ButtonLink>
        <Button variant='danger'>削除</Button>
      </>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A record with everything written */
export const Written: Story = {}

/**
 * A record with little written, changed after it was written, of a
 * customer who left the ledger and a product and a service the salon
 * removed
 */
export const Sparse: Story = {
  args: {
    record: aTreatment({
      services: ['0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e'],
      techniques: [],
      consultationNotes: null,
      scalpCondition: null,
      hairCondition: null,
      colorFormula: null,
      processingTime: null,
      nextRecommendedDate: null,
      nextRecommendedServices: [],
      homeCareSuggestions: null,
      customerSatisfaction: null,
      staffEvaluation: null,
      materials: [
        {
          productId: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
          quantity: 2,
          unit: '本',
          lotNumber: null,
          notes: null,
        },
      ],
      updatedAt: '2026-11-21T01:00:00.000Z',
    }),
    customer: undefined,
    actions: undefined,
  },
}

/** A record of a treatment without materials */
export const WithoutMaterials: Story = {
  args: { record: aTreatment({ materials: [] }) },
}
