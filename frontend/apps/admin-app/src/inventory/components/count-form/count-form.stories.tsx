import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { PRODUCTS_OF_THE_SALON } from '../../../products/components/examples'
import { countedControlOf } from '../../stock-count'
import { expiredColour, STOCK_OF_THE_SALON, shampooRow } from '../examples'
import { CountForm } from './count-form'

const meta: Meta<typeof CountForm> = {
  title: 'Admin/Inventory/CountForm',
  component: CountForm,
  args: {
    rows: STOCK_OF_THE_SALON,
    products: PRODUCTS_OF_THE_SALON,
    submitLabel: '記録する',
    actions: (
      <ButtonLink href={`/salons/${salon.id}/inventory`} variant='quiet'>
        やめる
      </ButtonLink>
    ),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every row of the salon, with what the books say of it */
export const Rows: Story = {}

/** What the form checked before sending: a count that is no quantity, and one below what is reserved */
export const WithErrors: Story = {
  args: {
    errors: {
      [countedControlOf(expiredColour.id)]:
        '数えた数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
      [countedControlOf(shampooRow.id)]:
        '引き当てた数の 2 本 を下回ります。引き当てた在庫も、数えた数に入れてください。',
    },
  },
}

/** A row counted was removed meanwhile: the rows were read anew */
export const RowsChanged: Story = {
  args: {
    message:
      '数えた在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数えた数を確かめて、もう一度記録してください。',
  },
}
