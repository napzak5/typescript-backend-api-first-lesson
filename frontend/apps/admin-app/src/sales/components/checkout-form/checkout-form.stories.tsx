import {
  CHECK_THE_VALUES_MESSAGE,
  FAILED,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { BillLine } from '../../utils/checkout'
import { aCalculation, services, staff } from '../examples'

import { CheckoutForm } from './checkout-form'

const { bill, notices, refusals } = adminSaleMessages.checkout

const [cut, colour] = services
const [misaki, ken] = staff

export const BOOKED: BillLine[] = [
  {
    serviceId: cut?.id ?? null,
    name: 'カット',
    unitPrice: 5500,
    discountAmount: 0,
    taxIncluded: true,
    staffId: misaki?.id ?? null,
  },
]

export const ADDED: BillLine[] = [
  {
    serviceId: colour?.id ?? null,
    name: 'カラー',
    unitPrice: 8800,
    discountAmount: 800,
    taxIncluded: true,
    staffId: ken?.id ?? null,
  },
]

const meta: Meta<typeof CheckoutForm> = {
  title: 'Admin/Sales/CheckoutForm',
  component: CheckoutForm,
  args: {
    booked: BOOKED,
    added: [],
    offered: services,
    staff,
    cashier: misaki?.id ?? '',
    currency: 'JPY',
    bill: { type: 'calculated', calculation: aCalculation() },
    changed: undefined,
    onAdd: fn(),
    onRemove: fn(),
    onRecalculate: fn(),
    recalculating: false,
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What the booking was booked for, nothing added */
export const AsBooked: Story = {}

/** A colour done beyond the booking, at a discount of the menu */
export const WithAddition: Story = {
  args: {
    added: ADDED,
    changed: notices.added('カラー'),
    bill: {
      type: 'calculated',
      calculation: aCalculation({
        breakdown: {
          subtotal: 14300,
          discountAmount: 800,
          taxAmount: 0,
          totalAmount: 13500,
        },
        recommendedMethods: ['cash', 'credit_card', 'e_money'],
      }),
    },
  },
}

/** The menu offers nothing to add: every service of it was stopped */
export const NothingOffered: Story = {
  args: { offered: [] },
}

/** A total that no kind of payment of the salon takes at once */
export const NoneRecommended: Story = {
  args: {
    bill: {
      type: 'calculated',
      calculation: aCalculation({ recommendedMethods: [] }),
    },
  },
}

/** A service of the booking that was removed from the menu since, billed at its price */
export const WithRemovedService: Story = {
  args: {
    booked: BOOKED.map((line) => ({ ...line, serviceId: null, name: null })),
  },
}

/** The amounts are on their way */
export const Calculating: Story = {
  args: { bill: { type: 'calculating' } },
}

/** A service that was added was removed from the menu meanwhile */
export const Uncalculated: Story = {
  args: {
    added: ADDED,
    bill: {
      type: 'uncalculated',
      message: bill.gone(['カラー']),
    },
  },
}

/** The amounts could not be asked for */
export const Unread: Story = {
  args: {
    bill: {
      type: 'unread',
      message: unreadMessageOf(adminSaleMessages.names.amounts, FAILED),
    },
  },
}

/** Nobody is recorded as having taken the payment, and the member chosen was refused */
export const WithErrors: Story = {
  args: {
    cashier: 'none',
    message: CHECK_THE_VALUES_MESSAGE,
    errors: { staffId: refusals.staffGone },
  },
}
