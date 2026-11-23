import { ButtonLink, useSay } from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SALE_GIVEN_FOR } from '../examples'
import { PointEntryForm } from './point-entry-form'

const { points: words } = adminCustomerMessages

/** The way back that the screen puts beside the button that records */
const Cancel = () => {
  const say = useSay()

  return (
    <ButtonLink href='#points' variant='quiet'>
      {say(words.form.cancel)}
    </ButtonLink>
  )
}

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
    actions: <Cancel />,
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
      name: words.sale.nameOf(
        'SL-2KQM-9F4H',
        {
          en: 'Fri, November 20, 2026 at 11:02',
          ja: '2026年11月20日（金） 11:02',
        },
        { en: '¥5,500', ja: '￥5,500' },
      ),
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
    sale: { type: 'unusable', why: words.sale.voided },
  },
}

/** What the API refused, said at the controls */
export const Refused: Story = {
  args: {
    initialKind: 'used',
    errors: { points: words.refusals.short(2700) },
  },
}

/** The recording is on its way */
export const Sending: Story = {
  args: { pending: true },
}
