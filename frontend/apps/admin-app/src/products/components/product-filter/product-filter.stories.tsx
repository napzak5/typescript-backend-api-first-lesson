import { tooLongOf } from '@beauty-salon-frontend/fields'
import { LONGEST_KEYWORD } from '@beauty-salon-frontend/salon-screens'
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ProductFilter } from './product-filter'

const meta: Meta<typeof ProductFilter> = {
  title: 'Admin/Products/ProductFilter',
  component: ProductFilter,
  args: {
    conditions: {},
    categories: ['スタイリング', 'ヘアカラー', 'ヘアケア'],
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The whole ledger */
export const Everything: Story = {}

/** Every condition, filled in */
export const Narrowed: Story = {
  args: {
    conditions: {
      keyword: 'シャンプー',
      barcode: '4901234567894',
      category: 'ヘアケア',
      carried: 'carried',
      use: 'sale',
    },
    clearHref: '?',
  },
}

/** A keyword that is too long */
export const WithErrors: Story = {
  args: {
    errors: {
      keyword: tooLongOf(adminProductMessages.filter.keyword, LONGEST_KEYWORD),
    },
  },
}
