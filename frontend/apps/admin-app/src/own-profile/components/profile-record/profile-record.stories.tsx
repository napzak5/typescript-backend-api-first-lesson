import type { Meta, StoryObj } from '@storybook/react-vite'
import { aProfile, CUSTOMER_VIEW } from '../examples'
import { ProfileRecord } from './profile-record'

const meta: Meta<typeof ProfileRecord> = {
  title: 'Admin/OwnProfile/ProfileRecord',
  component: ProfileRecord,
  args: { profile: aProfile(), customerView: CUSTOMER_VIEW },
}

export default meta

type Story = StoryObj<typeof meta>

/** A member who has introduced themselves with everything */
export const Introduced: Story = {}

/** A member of whom the customers are told nothing but the name, and who takes no bookings */
export const NotIntroducedYet: Story = {
  args: {
    profile: aProfile({
      position: null,
      specialties: [],
      bio: null,
      imageUrl: null,
      yearsOfExperience: null,
      certifications: [],
      canReceiveBookings: false,
    }),
  },
}
