import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SalonChoiceForm } from './salon-choice-form'

const meta: Meta<typeof SalonChoiceForm> = {
  title: 'Admin/Salons/SalonChoiceForm',
  component: SalonChoiceForm,
  args: {
    keyword: undefined,
    clearHref: '/',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every salon is listed */
export const Empty: Story = {}

/** The salons with a keyword are listed */
export const WithKeyword: Story = {
  args: { keyword: '表参道' },
}
