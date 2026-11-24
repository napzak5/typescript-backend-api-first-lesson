import { neededWithin } from '@beauty-salon-frontend/fields'
import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminPaymentMethodMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { card } from '../examples'
import { PaymentMethodForm } from './payment-method-form'

const { form, words } = adminPaymentMethodMessages

const meta: Meta<typeof PaymentMethodForm> = {
  title: 'Admin/PaymentMethods/PaymentMethodForm',
  component: PaymentMethodForm,
  args: {
    method: null,
    sortOrder: 5,
    submitLabel: '足す',
    actions: (
      <ButtonLink
        href={`/salons/${salon.id}/settings/payment-methods`}
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

/** A new method: the kind to choose, used at the counter, last in the order */
export const New: Story = {}

/** A card as it is kept: its kind is shown, not offered */
export const Recorded: Story = {
  args: { method: card(), submitLabel: '変更を保存する' },
}

/** What the form checked before sending: no name, a fee beyond 100, a largest amount below the smallest */
export const WithErrors: Story = {
  args: {
    errors: {
      method: form.errors.kind,
      displayName: neededWithin(words.displayName, 100),
      fee: form.errors.fee,
      maximumAmount: form.errors.range,
    },
  },
}

/** The API refused the account */
export const Refused: Story = {
  args: {
    method: card(),
    submitLabel: '変更を保存する',
    message: form.forbidden,
  },
}
