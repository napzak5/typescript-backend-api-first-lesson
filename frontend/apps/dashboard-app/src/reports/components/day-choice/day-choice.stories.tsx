import { salonScreenMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DayChoice } from './day-choice'

const meta: Meta<typeof DayChoice> = {
  title: 'Dashboard/Reports/DayChoice',
  component: DayChoice,
  args: { day: '2026-11-21', onSubmit: fn() },
}

export default meta

type Story = StoryObj<typeof meta>

/** The day of the address */
export const Chosen: Story = {}

/** A day that is not one, said beside the field */
export const Wrong: Story = {
  args: { errors: { date: salonScreenMessages.period.dayMissing } },
}
