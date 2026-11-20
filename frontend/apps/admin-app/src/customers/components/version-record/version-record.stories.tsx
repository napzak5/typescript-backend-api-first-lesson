import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { aVersion } from '../examples'
import { VersionRecord } from './version-record'

const meta: Meta<typeof VersionRecord> = {
  title: 'Admin/Customers/VersionRecord',
  component: VersionRecord,
  args: {
    version: aVersion({
      version: 4,
      phoneNumber: '080-3333-4444',
      postalCode: '150-0001',
      prefecture: '東京都',
      city: '渋谷区',
      address: '神宮前 4-1-1',
      tags: ['VIP'],
      referredBy: 'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
    }),
    previous: aVersion({ version: 3, tags: ['VIP'] }),
    changer: 'あなた',
    timezone: salon.timezone,
    customerHref: (customerId) => `/salons/${salon.id}/customers/${customerId}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** An update: what it changed, the value before beside the value after */
export const Update: Story = {}

/** An update that changed no value */
export const Unchanged: Story = {
  args: {
    version: aVersion({ version: 4 }),
    previous: aVersion({ version: 3 }),
    changer: 'ほかのアカウント',
  },
}

/** A version that is the whole record: only its values */
export const Registration: Story = {
  args: {
    version: aVersion({ version: 1, operation: 'create' }),
    previous: undefined,
  },
}

/** The values the history began with, which nobody made */
export const Baseline: Story = {
  args: {
    version: aVersion({ version: 1, operation: 'baseline', changedBy: null }),
    previous: undefined,
    changer: '',
  },
}
