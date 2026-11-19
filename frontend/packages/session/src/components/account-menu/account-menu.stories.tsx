import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { AccountMenu } from './account-menu'

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

const meta: Meta<typeof AccountMenu> = {
  title: 'Session/AccountMenu',
  component: AccountMenu,
  args: {
    session: { type: 'signedIn', user },
    onSignOut: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const SignedIn: Story = {}

export const LongAddress: Story = {
  args: {
    session: {
      type: 'signedIn',
      user: {
        ...user,
        email: 'hanako.yamada.reservations@beauty-salon-group.example.com',
      },
    },
  },
}

/** An application with screens for everybody offers the way to its sign-in screen. */
export const SignedOutWithSignInScreen: Story = {
  args: { session: { type: 'signedOut' }, signInHref: '/sign-in' },
}

/** An application that is all behind the sign-in screen shows nothing. */
export const SignedOut: Story = {
  args: { session: { type: 'signedOut' } },
}

export const Loading: Story = {
  args: { session: { type: 'loading' }, signInHref: '/sign-in' },
}
