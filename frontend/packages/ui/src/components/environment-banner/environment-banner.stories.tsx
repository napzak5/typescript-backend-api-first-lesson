import type { Meta, StoryObj } from '@storybook/react-vite'
import { EnvironmentBanner } from './environment-banner'

const meta: Meta<typeof EnvironmentBanner> = {
  title: 'Components/EnvironmentBanner',
  component: EnvironmentBanner,
}

export default meta

type Story = StoryObj<typeof meta>

export const Development: Story = {
  args: { environment: 'development' },
}

export const Staging: Story = {
  args: { environment: 'staging' },
}

export const Test: Story = {
  args: { environment: 'test' },
}

export const Localhost: Story = {
  args: { environment: 'localhost' },
}

export const Production: Story = {
  args: { environment: 'production' },
}
