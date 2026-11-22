import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotFoundPage } from './not-found-page'

const meta: Meta<typeof NotFoundPage> = {
  title: 'AppFrame/NotFoundPage',
  component: NotFoundPage,
}

export default meta

type Story = StoryObj<typeof meta>

export const NotFound: Story = {}
