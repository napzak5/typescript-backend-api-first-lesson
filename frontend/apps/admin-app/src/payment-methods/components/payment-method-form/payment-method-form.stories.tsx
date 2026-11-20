import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { card } from '../examples'
import { PaymentMethodForm } from './payment-method-form'

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
      method: '種類を選んでください。',
      displayName: '表示名を、100 文字までで入力してください。',
      fee: '手数料率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
      maximumAmount: '上限は、下限と同じか、下限より大きい金額にしてください。',
    },
  },
}

/** The API refused the account */
export const Refused: Story = {
  args: {
    method: card(),
    submitLabel: '変更を保存する',
    message:
      'このサロンの支払い方法は、変えられません。支払い方法を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
  },
}
