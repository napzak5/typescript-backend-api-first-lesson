import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import {
  fieldMessages,
  preferenceMessages,
} from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import {
  noPreferences,
  preferences,
  preferencesOfStaffThatLeft,
  staff,
  wordyPreferences,
} from '../examples'
import { PreferencesForm } from './preferences-form'

const meta: Meta<typeof PreferencesForm> = {
  title: 'Preferences/PreferencesForm',
  component: PreferencesForm,
  args: {
    preferences,
    staff,
    submitLabel: '変更を保存する',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The preferences there are, to be changed */
export const Filled: Story = {}

/** Somebody who has said nothing yet */
export const Empty: Story = {
  args: { preferences: noPreferences },
}

/** Somebody who has no booking anywhere: there is nobody to wish for or to avoid */
export const WithoutStaff: Story = {
  args: { preferences: noPreferences, staff: [] },
}

/** The member who was wished for, and one of those to avoid, are not offered: their salons no longer show them */
export const StaffThatLeft: Story = {
  args: { preferences: preferencesOfStaffThatLeft },
}

/** What is wrong is said at its control; the first of them has the focus */
export const WithErrors: Story = {
  args: {
    errors: {
      avoidStaffIds: preferenceMessages.flow.avoidedIsWishedFor,
      'preferredTimeSlots.1.endTime': preferenceMessages.flow.endNotLater,
      'stylePreferences.inspirationImages': fieldMessages.lineToCheck(
        2,
        fieldMessages.notWebAddress(500),
      ),
      communicationStyle: fieldMessages.tooLong(100),
    },
  },
}

/** Nothing came of the attempt, and no control is to blame */
export const WithMessage: Story = {
  args: {
    message: NOT_SENT_MESSAGE,
  },
}

export const Pending: Story = {
  args: { pending: true },
}

/** Long values, one of them an address without a place to break a line */
export const Wordy: Story = {
  args: { preferences: wordyPreferences },
}
