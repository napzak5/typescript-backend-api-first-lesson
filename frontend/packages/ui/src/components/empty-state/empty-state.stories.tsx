import type { Meta, StoryObj } from '@storybook/react-vite'
import { ButtonLink } from '../button-link/button-link'
import { EmptyState } from './empty-state'

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  args: {
    title: '予約はまだありません',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const TitleOnly: Story = {}

export const WithDescription: Story = {
  args: { description: '予約すると、ここに表示されます。' },
}

export const WithActions: Story = {
  args: {
    description: '予約すると、ここに表示されます。',
    actions: (
      <ButtonLink href='/salons' variant='primary'>
        サロンを探す
      </ButtonLink>
    ),
  },
}

/** Inside a card: the photos of a treatment, while there are none */
export const InAPart: Story = {
  args: { title: '施術写真はありません。', kind: 'part' },
}
