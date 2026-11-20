import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { shampoo } from '../examples'
import { ProductForm } from './product-form'

const meta: Meta<typeof ProductForm> = {
  title: 'Admin/Products/ProductForm',
  component: ProductForm,
  args: {
    product: null,
    submitLabel: '足す',
    actions: (
      <ButtonLink href={`/salons/${salon.id}/products`} variant='quiet'>
        やめる
      </ButtonLink>
    ),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A new product: used in treatments and carried, of a minimum stock of 0 */
export const New: Story = {}

/** A shampoo as it is kept, with every value noted */
export const Recorded: Story = {
  args: { product: shampoo, submitLabel: '変更を保存する' },
}

/** What the form checked before sending: no code, a negative price, levels out of order, an address that is no web address */
export const WithErrors: Story = {
  args: {
    errors: {
      productCode: '商品コードを、100 文字までで入力してください。',
      purchasePrice: '仕入価格は、0 以上の円の整数で入力してください。',
      reorderPoint:
        '発注点は、最低在庫数と同じか、それより大きい数にしてください。',
      safetyDataSheet:
        'http:// または https:// で始まる URL を、500 文字以内で入力してください。',
    },
  },
}

/** The API refused the account */
export const Refused: Story = {
  args: {
    product: shampoo,
    submitLabel: '変更を保存する',
    message:
      'このサロンの商品は、変えられません。商品を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
  },
}
