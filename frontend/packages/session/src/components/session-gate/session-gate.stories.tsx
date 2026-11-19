import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SessionGate } from './session-gate'

const user: ModelsUserResponse = {
  id: '0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f07',
  email: 'hanako@example.com',
  role: 'customer',
  status: 'active',
  emailVerified: true,
  lastPasswordChange: null,
  twoFactorStatus: 'disabled',
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: '2026-11-19T01:00:00.000Z',
  lastLoginIp: null,
  customerId: null,
  staffId: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-19T01:00:00.000Z',
}

const meta: Meta<typeof SessionGate> = {
  title: 'Session/SessionGate',
  component: SessionGate,
  args: {
    session: { type: 'signedIn', user },
    roles: ['customer'],
    signIn: <p>サインインの画面</p>,
    onSignOut: fn(),
    children: <p>マイページの内容</p>,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A signed-in user of one of the roles sees the content. */
export const Allowed: Story = {}

/** A session is stored and the API is being asked whose it is. */
export const Loading: Story = {
  args: { session: { type: 'loading' } },
}

export const SignedOut: Story = {
  args: { session: { type: 'signedOut' } },
}

/** The API did not say whose the stored session is. */
export const Unavailable: Story = {
  args: { session: { type: 'unavailable', retry: fn() } },
}

/** Signed in, with an account of a role the content is not for. */
export const AnotherRole: Story = {
  args: { roles: ['owner', 'manager', 'staff', 'admin'] },
}
