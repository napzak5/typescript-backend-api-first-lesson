import { FAILED, unreadMessageOf } from '@beauty-salon-frontend/answers'
import { adminChartMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aCustomer, salon } from '../../../bookings/components/examples'
import { allergies, anAllergy } from '../examples'
import { AllergyList } from './allergy-list'

const { removal } = adminChartMessages.allergies

const chartHref = `/salons/${salon.id}/customers/${aCustomer().id}/chart`

const meta: Meta<typeof AllergyList> = {
  title: 'Admin/Charts/AllergyList',
  component: AllergyList,
  parameters: {
    // The dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '30rem' } },
  },
  args: {
    shown: { type: 'listed', allergies: allergies(), total: 3, more: 'none' },
    onRetry: fn(),
    onMore: fn(),
    entryHref: `${chartHref}/allergies/new`,
    changeHrefOf: ({ id }) => `${chartHref}/allergies/${id}/edit`,
    removable: true,
    removing: undefined,
    onOpen: fn(),
    onClose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** An owner or a manager: the allergies, the heaviest first, each changed and removed */
export const Listed: Story = {}

/** A member of the staff changes them, and is told who removes them */
export const ByStaff: Story = {
  args: { removable: false },
}

/** A customer without allergies */
export const NoAllergies: Story = {
  args: {
    shown: { type: 'listed', allergies: [], total: 0, more: 'none' },
  },
}

/** More allergies than a page, and the button that reads the next */
export const More: Story = {
  args: {
    shown: {
      type: 'listed',
      allergies: [anAllergy()],
      total: 21,
      more: 'available',
    },
  },
}

/** The allergies are read */
export const Reading: Story = {
  args: { shown: { type: 'reading' } },
}

/** The allergies could not be read */
export const Unread: Story = {
  args: {
    shown: {
      type: 'unread',
      message: unreadMessageOf(adminChartMessages.names.allergies, FAILED),
      retrying: false,
    },
  },
}

/** The dialog asks before an allergy is removed */
export const Asking: Story = {
  args: { removing: anAllergy() },
}

/** The removal is on its way */
export const Removing: Story = {
  args: { removing: anAllergy(), pending: true },
}

/** The removal failed, and may be tried again */
export const RemovalFailed: Story = {
  args: {
    removing: anAllergy(),
    message: removal.failed,
  },
}

/** Another account removed the allergy meanwhile: said under the heading */
export const Gone: Story = {
  args: {
    refusal: removal.gone,
  },
}
