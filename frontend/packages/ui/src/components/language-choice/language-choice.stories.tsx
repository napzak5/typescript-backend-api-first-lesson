import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { LanguageChoice } from './language-choice'

const meta: Meta<typeof LanguageChoice> = {
  title: 'Components/LanguageChoice',
  component: LanguageChoice,
  args: { language: 'ja', place: 'header', onChoose: fn() },
}

export default meta

type Story = StoryObj<typeof meta>

export const InHeader: Story = {}

export const EnglishInHeader: Story = {
  args: { language: 'en' },
}

export const InMenu: Story = {
  args: { place: 'menu' },
}
