import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon, staff } from '../../../bookings/components/examples'
import {
  ALERTS_OF_OTHER_DAYS,
  ALERTS_OF_THE_SALON,
  expiredColourAlert,
  outOfGlovesAlert,
} from '../examples'
import { AlertTable } from './alert-table'

const meta: Meta<typeof AlertTable> = {
  title: 'Admin/Inventory/AlertTable',
  component: AlertTable,
  args: {
    caption: adminInventoryMessages.alerts.list.caption,
    alerts: ALERTS_OF_THE_SALON,
    staff,
    timezone: salon.timezone,
    rowHref: (inventoryId) => `/salons/${salon.id}/inventory/${inventoryId}`,
    total: 2,
    more: 'none',
    onMore: fn(),
    onAcknowledge: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A lot past its expiry that a member of the staff saw to, and gloves of which none is left */
export const Alerts: Story = {}

/** An alert of each of the other kinds */
export const OfEveryKind: Story = {
  args: { alerts: ALERTS_OF_OTHER_DAYS, total: 3 },
}

/** An administrator saw to the lot: the salon names nobody */
export const AcknowledgedByAnAdministrator: Story = {
  args: {
    alerts: [
      {
        ...expiredColourAlert,
        acknowledgement:
          expiredColourAlert.acknowledgement === null
            ? null
            : {
                ...expiredColourAlert.acknowledgement,
                acknowledgedBy: null,
                notes: null,
              },
      },
    ],
    total: 1,
  },
}

/** The staff, who saw to the alerts, are being read */
export const WhileTheStaffAreRead: Story = {
  args: { staff: undefined },
}

/** More alerts than a page, and the button that reads the next */
export const More: Story = {
  args: { alerts: [outOfGlovesAlert], total: 21, more: 'available' },
}
