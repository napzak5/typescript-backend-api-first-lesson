import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { hoursOf } from '../../api/hours-api'
import { aDescribedSalon, TODAY } from '../examples'
import { HoursForm } from './hours-form'

const { hoursForm } = adminSettingsMessages

const HOURS = hoursOf(aDescribedSalon())

const meta: Meta<typeof HoursForm> = {
  title: 'Admin/Settings/HoursForm',
  component: HoursForm,
  args: {
    hours: HOURS,
    today: TODAY,
    timezone: 'Asia/Tokyo',
    submitLabel: '保存する',
    actions: (
      <ButtonLink href='/salons/salon/settings' variant='quiet'>
        やめる
      </ButtonLink>
    ),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/**
 * The hours of the stories: the week with a break on Monday and Sunday
 * closed, a holiday the salon opens on for shorter hours, a day off, and a
 * date before today, which is kept out of sight
 */
export const Whole: Story = {}

/** A salon without hours recorded: every day closed, and no date */
export const Empty: Story = {
  args: { hours: { businessHours: null, openingHours: [] } },
}

/** A day with two hours, of which the form holds the first, and a day whose hours are kept for a period */
export const MoreThanTheFormHolds: Story = {
  args: {
    hours: {
      ...HOURS,
      businessHours: (HOURS.businessHours ?? []).map((entry) =>
        entry.dayOfWeek === 'monday'
          ? {
              ...entry,
              operatingSlots: [
                { startTime: '10:00', endTime: '13:00' },
                { startTime: '15:00', endTime: '20:00' },
              ],
              breakSlots: null,
            }
          : entry.dayOfWeek === 'saturday'
            ? {
                ...entry,
                effectivePeriod: {
                  startDate: '2026-04-01T00:00:00+09:00',
                  endDate: '2027-03-31T00:00:00+09:00',
                },
              }
            : entry,
      ),
    },
  },
}

/** What the form checked before sending: a closing before the opening, and a date given twice */
export const WithErrors: Story = {
  args: {
    errors: {
      'monday.closeTime': hoursForm.errors.closeBeforeOpen,
      'dates.1.date': hoursForm.errors.sameDate(1),
    },
  },
}

/** Another account changed the hours since the form opened */
export const ChangedMeanwhile: Story = {
  args: {
    message: hoursForm.changedMeanwhile,
  },
}
