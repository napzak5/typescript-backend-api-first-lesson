import type { Meta, StoryObj } from '@storybook/react-vite'
import { aSchedule, aWeek, TODAY } from '../examples'
import { ScheduleRecord } from './schedule-record'

const meta: Meta<typeof ScheduleRecord> = {
  title: 'Admin/Shifts/ScheduleRecord',
  component: ScheduleRecord,
  args: { rows: aSchedule(), today: TODAY },
}

export default meta

type Story = StoryObj<typeof meta>

/**
 * The week, Sunday off with a note, a date of a week before (counted), a
 * training on a day before today (counted) and shorter hours on Saturday
 */
export const Whole: Story = {}

/** The weekly rows alone: no row of a date */
export const WeeklyOnly: Story = { args: { rows: aWeek() } }

/** A member without a schedule */
export const Empty: Story = { args: { rows: [] } }
