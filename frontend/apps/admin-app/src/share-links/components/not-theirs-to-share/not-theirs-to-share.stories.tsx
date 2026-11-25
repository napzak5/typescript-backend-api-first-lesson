import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotTheirsToShare } from './not-theirs-to-share'

const meta: Meta<typeof NotTheirsToShare> = {
  title: 'Admin/ShareLinks/NotTheirsToShare',
  component: NotTheirsToShare,
}

export default meta

type Story = StoryObj<typeof meta>

/** A member of the staff, who shares no file */
export const MemberOfTheStaff: Story = {}
