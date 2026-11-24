import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import {
  aBooking,
  services,
  staff,
} from '../../../bookings/components/examples'
import { aTreatment, products } from '../examples'
import { TreatmentForm } from './treatment-form'

const { errors, failed } = adminTreatmentMessages.form

const meta: Meta<typeof TreatmentForm> = {
  title: 'Admin/Treatments/TreatmentForm',
  component: TreatmentForm,
  args: {
    booking: aBooking({ status: 'completed' }),
    staff,
    services,
    products,
    submitLabel: '施術記録を書く',
    onSubmit: fn(),
    actions: (
      <ButtonLink href='/' variant='quiet'>
        やめる
      </ButtonLink>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A record that is written: it opens with the member and the services of the booking */
export const New: Story = {}

/** A record that is changed: the form opens with what is stored, and names its member */
export const Opened: Story = {
  args: { record: aTreatment(), submitLabel: '変更を保存する' },
}

/** A record of a service and a product the salon removed since */
export const WithRemoved: Story = {
  args: {
    record: aTreatment({
      services: ['0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e'],
      materials: [
        {
          productId: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
          quantity: 2,
          unit: '本',
          lotNumber: 'OLD-7',
          notes: null,
        },
      ],
    }),
    submitLabel: '変更を保存する',
  },
}

/** What is wrong, under the controls of a material and of the record */
export const WithErrors: Story = {
  args: {
    record: aTreatment(),
    submitLabel: '変更を保存する',
    errors: {
      'materials.1.quantity': errors.quantity,
      nextRecommendedDate: errors.nextRecommendedDateTooEarly(
        dayNameOf('2026-11-20'),
      ),
    },
  },
}

/** As many materials as a record holds: none more is offered */
export const Full: Story = {
  args: {
    record: aTreatment({
      materials: Array.from({ length: 50 }, () => ({
        productId: products[1]?.id ?? '',
        quantity: 10,
        unit: 'ml',
        lotNumber: null,
        notes: null,
      })),
    }),
    submitLabel: '変更を保存する',
  },
}

/** The record is on its way */
export const Sending: Story = {
  args: { record: aTreatment(), submitLabel: '変更を保存する', pending: true },
}

/** The record could not be sent */
export const NotSent: Story = {
  args: {
    message: failed.entry,
  },
}
