import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { colour, shampoo } from '../../../products/components/examples'
import { recordedKindsOf } from '../../utils/movement-format'
import { colourLot, shampooRow } from '../examples'
import { MovementForm } from './movement-form'

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
      transactionType: '区分を選んでください。',
      quantity:
        '数量は、0.01 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
      unitCost: '単価は、0 以上の円の整数で入力してください。',
    },
  },
}

/** The API refused the account */
export const Refused: Story = {
  args: {
    offered: recordedKindsOf(false),
    message:
      'このアカウントでは、この在庫の移動を記録できません。在庫の調整、廃棄、サロン間の移動を記録できるのは、サロンのオーナーとマネージャーと、管理者です。',
  },
}
