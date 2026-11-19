import type { Meta, StoryObj } from '@storybook/react-vite'
import { newProfile, profile, wordyProfile } from '../examples'
import { ProfileDetails } from './profile-details'

const meta: Meta<typeof ProfileDetails> = {
  title: 'Portal/Profile/ProfileDetails',
  component: ProfileDetails,
  args: { profile },
}

export default meta

type Story = StoryObj<typeof meta>

/** Somebody who has said everything about themselves */
export const Complete: Story = {}

/** Somebody who has said who they are and how to reach them, and nothing else */
export const OnlyWhoTheyAre: Story = {
  args: { profile: newProfile },
}

/** Long values, one of them without a place to break a line */
export const Wordy: Story = {
  args: { profile: wordyProfile },
}
