import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminShiftMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aSchedule, TODAY } from '../examples'
import { ScheduleForm } from './schedule-form'

const { form } = adminShiftMessages

const meta: Meta<typeof ScheduleForm> = {
  title: 'Admin/Shifts/ScheduleForm',
  component: ScheduleForm,
  args: {
    rows: aSchedule(),
    today: TODAY,
    submitLabel: '保存する',
    actions: (
      <ButtonLink href='/salons/salon/shifts/tanaka' variant='quiet'>
        やめる
      </ButtonLink>
    ),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/**
 * The schedule of the stories: the week with Sunday off, a row of a date
 * from today, and two rows of the days before today, which are kept unless
 * they are to go
 */
export const Whole: Story = {}

/** A member without a schedule: every day without work, and no row of a date */
export const Empty: Story = { args: { rows: [] } }

/** What the form checked before sending: an end before the start, and the date of a row of a day before today */
export const WithErrors: Story = {
  args: {
    errors: {
      'monday.endTime': form.errors.endBeforeStart,
      'dates.0.date': form.errors.pastDateKept,
    },
  },
}

/** Another account changed the schedule since the form opened */
export const ChangedMeanwhile: Story = {
  args: {
    message: form.changedMeanwhile,
  },
}
