import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SalonSearchForm } from './salon-search-form'

const meta: Meta<typeof SalonSearchForm> = {
  title: 'Portal/Salons/SalonSearchForm',
  component: SalonSearchForm,
  args: {
    conditions: {},
    clearHref: '/',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Nothing narrows the search: every salon is looked for */
export const WithoutConditions: Story = {}

/** The conditions of the address are in the controls, and can be dropped */
export const WithConditions: Story = {
  args: {
    conditions: {
      keyword: 'こもれび',
      prefecture: '東京都',
      city: '渋谷区',
      minRating: 4,
    },
  },
}
