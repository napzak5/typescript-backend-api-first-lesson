import type { Meta, StoryObj } from '@storybook/react-vite'
import { NoSalonNotice } from './no-salon-notice'

const meta: Meta<typeof NoSalonNotice> = {
  title: 'Session/NoSalonNotice',
  component: NoSalonNotice,
}

export default meta

type Story = StoryObj<typeof meta>

export const NoSalon: Story = {}
