import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import {
  READ_AT,
  RUNNING,
  SILENT,
  TIMEZONE,
  WITHOUT_DATABASE,
} from '../examples'
import { SystemStateRecord } from './system-state'

const meta: Meta<typeof SystemStateRecord> = {
  title: 'Admin/Operations/SystemStateRecord',
  component: SystemStateRecord,
  args: {
    state: RUNNING,
    readAt: READ_AT,
    timezone: TIMEZONE,
    onCheck: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** An API that runs, takes requests and reaches its database */
export const Running: Story = {}

/** The probes are being asked again */
export const Checking: Story = {
  args: { checking: true },
}

/** An API that runs and cannot reach its database */
export const WithoutDatabase: Story = {
  args: { state: WITHOUT_DATABASE },
}

/** An API that does not answer, or that this device does not reach */
export const Silent: Story = {
  args: { state: SILENT },
}
