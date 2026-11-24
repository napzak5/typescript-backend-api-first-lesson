import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { staffLabelOf, staffNamed } from '../../utils/staff-choices'
import {
  noPreferences,
  preferences,
  preferencesOfStaffThatLeft,
  staff,
  wordyPreferences,
} from '../examples'
import { PreferencesDetails } from './preferences-details'

const meta: Meta<typeof PreferencesDetails> = {
  title: 'Preferences/PreferencesDetails',
  component: PreferencesDetails,
  args: {
    preferences,
    staffNames: (ids) => staffNamed(ids, staff),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Somebody who has said everything a salon can keep in mind */
export const Complete: Story = {}

/** Somebody who has said nothing yet */
export const Nothing: Story = {
  args: { preferences: noPreferences },
}

/** Long values, one of them an address without a place to break a line */
export const Wordy: Story = {
  args: { preferences: wordyPreferences },
}

/** The member who was wished for, and one of those to avoid, are no longer shown by their salons: the screen leaves them out */
export const StaffThatLeft: Story = {
  args: { preferences: preferencesOfStaffThatLeft },
}

/** The same preferences on a screen that says of a member nobody shows any more that there is one, as the admin application does */
export const StaffThatLeftSaidSo: Story = {
  args: {
    preferences: preferencesOfStaffThatLeft,
    staffNames: (ids) =>
      ids.map((id) => {
        const member = staff.find((choice) => choice.id === id)

        return member === undefined
          ? adminStaffMessages.unlisted
          : staffLabelOf(member)
      }),
  },
}

/** A stored value that is no address of the web is text, and no link */
export const ImageThatIsNoAddress: Story = {
  args: {
    preferences: {
      ...noPreferences,
      stylePreferences: {
        preferredLength: null,
        preferredColors: [],
        avoidStyles: [],
        inspirationImages: ['雑誌の切り抜きを持っていきます'],
      },
    },
  },
}
