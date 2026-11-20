import type { Meta, StoryObj } from '@storybook/react-vite'
import { aSale, customers, salon } from '../examples'
import { SalePoints } from './sale-points'

const POINTS = `/salons/${salon.id}/customers/${customers[0]?.id ?? ''}/points/new`

const meta: Meta<typeof SalePoints> = {
  title: 'Admin/Sales/SalePoints',
  component: SalePoints,
  args: {
    usedHref: `${POINTS}?saleId=${aSale().id}&kind=used`,
    earnedHref: `${POINTS}?saleId=${aSale().id}&kind=earned`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A sale of a customer that is not void */
export const Points: Story = {}
