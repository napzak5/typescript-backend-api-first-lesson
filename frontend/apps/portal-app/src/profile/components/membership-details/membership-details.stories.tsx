import type { Meta, StoryObj } from '@storybook/react-vite'
import { newProfile, profile } from '../examples'
import { MembershipDetails } from './membership-details'

const meta: Meta<typeof MembershipDetails> = {
  title: 'Portal/Profile/MembershipDetails',
  component: MembershipDetails,
  args: { profile },
}

export default meta

type Story = StoryObj<typeof meta>

/** Somebody who has come for years */
export const Member: Story = {}

/** Somebody who has not come yet: no visit, no code, nothing written down of their hair */
export const New: Story = {
  args: { profile: newProfile },
}

/** More points than three digits hold */
export const WithManyPoints: Story = {
  args: {
    profile: {
      ...profile,
      membershipTier: 'vip',
      loyaltyPoints: 1234567,
      visitCount: 1024,
    },
  },
}
