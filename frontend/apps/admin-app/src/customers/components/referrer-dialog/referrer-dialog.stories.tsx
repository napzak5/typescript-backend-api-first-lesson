import { EmptyState } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { customers } from '../../../bookings/components/examples'
import { CustomerChoices } from '../customer-choices/customer-choices'
import { ReferrerDialog } from './referrer-dialog'

const meta: Meta<typeof ReferrerDialog> = {
  title: 'Admin/Customers/ReferrerDialog',
  component: ReferrerDialog,
  args: {
    open: true,
    onClose: fn(),
    keyword: undefined,
    onSearch: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Opened: nothing was searched for yet */
export const BeforeASearch: Story = {}

/** The customers a keyword found, each chosen by their name */
export const Found: Story = {
  args: {
    keyword: '山田',
    children: (
      <CustomerChoices
        customers={customers}
        total={customers.length}
        more='none'
        onMore={fn()}
        choose={{ type: 'button', onChoose: fn(), excluded: undefined }}
      />
    ),
  },
}

/** A keyword that found nobody */
export const Nobody: Story = {
  args: {
    keyword: '佐藤',
    children: (
      <EmptyState
        title='キーワードに合うお客様が見つかりませんでした'
        description='キーワードを変えて、もう一度お探しください。'
      />
    ),
  },
}
