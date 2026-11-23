import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { colour, shampoo } from '../../../products/components/examples'
import { recordedKindsOf } from '../../utils/movement-format'
import { colourLot, shampooRow } from '../examples'
import { MovementForm } from './movement-form'

const { errors } = adminInventoryMessages.movements

const meta: Meta<typeof MovementForm> = {
  title: 'Admin/Inventory/MovementForm',
  component: MovementForm,
  args: {
    row: colourLot,
    product: colour,
    offered: recordedKindsOf(true),
    submitLabel: '記録する',
    actions: (
      <ButtonLink
        href={`/salons/${salon.id}/inventory/${colourLot.id}`}
        variant='quiet'
      >
        やめる
      </ButtonLink>
    ),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A lot of the colour, for one who keeps the stock: every kind */
export const ForAKeeper: Story = {}

/** The shampoo, part of it reserved, for a stylist: the kinds of every day */
export const ForAStylist: Story = {
  args: {
    row: shampooRow,
    product: shampoo,
    offered: recordedKindsOf(false),
  },
}

/** What the form checked before sending: no kind, no quantity, a cost that is no amount */
export const WithErrors: Story = {
  args: {
    errors: {
      transactionType: errors.kind,
      quantity: errors.quantity,
      unitCost: errors.unitCost,
    },
  },
}

/** The API refused the account */
export const Refused: Story = {
  args: {
    offered: recordedKindsOf(false),
    message: adminInventoryMessages.movements.forbidden,
  },
}
