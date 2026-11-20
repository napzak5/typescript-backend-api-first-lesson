import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SALE_GIVEN_FOR } from '../examples'
import { PointEntryForm } from './point-entry-form'

const meta: Meta<typeof PointEntryForm> = {
  title: 'Admin/Customers/PointEntryForm',
  component: PointEntryForm,
  args: {
    kinds: ['earned', 'used'],
    initialKind: 'earned',
    balance: 2700,
    today: '2026-11-20',
    sale: undefined,
    onSubmit: fn(),
    actions: (
      <ButtonLink href='#points' variant='quiet'>
        やめる
      </ButtonLink>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Points given or used at the counter, by a member of the staff */
export const Counter: Story = {}

/** The points a customer used at the checkout of a sale, from the page of the sale */
export const ForSale: Story = {
  args: {
    initialKind: 'used',
    sale: {
      type: 'sale',
      id: SALE_GIVEN_FOR,
      name: '売上番号 SL-2KQM-9F4H（2026年11月20日（金） 11:02、￥5,500）',
    },
  },
}

/** An owner or a manager adjusts the balance too */
export const Adjusting: Story = {
  args: { kinds: ['earned', 'used', 'added', 'taken'] },
}

/** The sale of the address cannot be what the points are for */
export const UnusableSale: Story = {
  args: {
    sale: {
      type: 'unusable',
      why: 'この売上は取り消されているため、ポイントを結びつけません。',
    },
  },
}

/** What the API refused, said at the controls */
export const Refused: Story = {
  args: {
    initialKind: 'used',
    errors: { points: '残高（2,700 ポイント）より多くは減らせません。' },
  },
}

/** The recording is on its way */
export const Sending: Story = {
  args: { pending: true },
}
