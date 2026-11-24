import { neededWithin } from '@beauty-salon-frontend/fields'
import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { LONGEST_NAME } from '../../utils/salon-form'
import { aDescribedSalon } from '../examples'
import { SalonForm } from './salon-form'

const { change, form } = adminSettingsMessages

const meta: Meta<typeof SalonForm> = {
  title: 'Admin/Settings/SalonForm',
  component: SalonForm,
  args: {
    subject: { type: 'existing', salon: aDescribedSalon() },
    submitLabel: '変更を保存する',
    onSubmit: fn(),
    actions: (
      <ButtonLink href='/' variant='quiet'>
        やめる
      </ButtonLink>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Opened with a salon that has every value recorded */
export const Recorded: Story = {}

/** Opened with a salon that has little recorded: the controls of what it has not are empty */
export const LittleRecorded: Story = {
  args: { subject: { type: 'existing', salon } },
}

/** A salon to be added: nothing written, the time zone and the currency of Japan, a tax of 10 %, and no bookings online */
export const New: Story = {
  args: { subject: { type: 'new' }, submitLabel: 'サロンを登録する' },
}

/** A salon to be added, with what is wrong with its time zone and its currency */
export const NewWithErrors: Story = {
  args: {
    subject: { type: 'new' },
    submitLabel: 'サロンを登録する',
    errors: {
      timezone: form.errors.timezone,
      currency: form.errors.currency,
    },
  },
}

/** What is wrong with the values, at their controls */
export const WithErrors: Story = {
  args: {
    errors: {
      name: neededWithin(form.salonName, LONGEST_NAME),
      latitude: form.errors.latitude,
      email: form.errors.emailTaken,
      taxRate: form.errors.taxRate,
    },
  },
}

/** What went wrong with the attempt as a whole */
export const NotChanged: Story = {
  args: {
    message: change.failed,
  },
}
