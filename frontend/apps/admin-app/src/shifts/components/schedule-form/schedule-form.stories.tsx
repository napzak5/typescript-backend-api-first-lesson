import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aSchedule, TODAY } from '../examples'
import { ScheduleForm } from './schedule-form'

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

/** What the form checked before sending: an end before the start, and a date given twice */
export const WithErrors: Story = {
  args: {
    errors: {
      'monday.endTime':
        '勤務の終わりは、始まりより後の時刻にしてください。日付をまたぐ勤務は入れられません。',
      'dates.0.date': 'この日付は、ほかの行と同じです。',
    },
  },
}

/** Another account changed the schedule since the form opened */
export const ChangedMeanwhile: Story = {
  args: {
    message:
      'その間に、ほかのアカウントがこの勤務スケジュールを変えていました。このフォームの内容は、まだ保存していません。',
  },
}
