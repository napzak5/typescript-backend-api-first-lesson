import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { phone, sessions, thisDevice } from '../examples'
import { SessionList } from './session-list'

const meta: Meta<typeof SessionList> = {
  title: 'Session/Security/SessionList',
  component: SessionList,
  args: {
    sessions,
    total: sessions.length,
    more: 'none',
    onMore: fn(),
    onEnd: fn(),
    timeZone: 'Asia/Tokyo',
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** This device, one of which the API kept nothing, and a phone */
export const SeveralDevices: Story = {}

/** Signed in here and nowhere else */
export const OnlyThisDevice: Story = {
  args: { sessions: [thisDevice], total: 1 },
}

/** The phone is being signed out */
export const Ending: Story = {
  args: { ending: phone.id },
}

/** The list goes on */
export const WithMore: Story = {
  args: { total: 24, more: 'available' },
}

export const LoadingMore: Story = {
  args: { total: 24, more: 'loading' },
}

/** The devices that come next were asked for and did not come */
export const MoreFailed: Story = {
  args: { total: 24, more: 'failed' },
}

/** The API did not say how many there are */
export const NotCounted: Story = {
  args: { total: null, more: 'available' },
}
