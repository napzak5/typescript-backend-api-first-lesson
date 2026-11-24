import type { Meta, StoryObj } from '@storybook/react-vite'
import { aBooking, moment, salon, services, staff } from '../examples'
import { MovedLines } from './moved-lines'

const [cut, color] = services
const [misaki, ken] = staff

const meta: Meta<typeof MovedLines> = {
  title: 'Admin/Bookings/MovedLines',
  component: MovedLines,
  args: {
    lines: [
      {
        id: 'e3b16f9c-8a0e-4cf1-8fd0-ce9a5b8cade7',
        serviceId: cut?.id ?? '',
        staffId: ken?.id ?? null,
        startTime: moment(60),
        endTime: moment(120),
        duration: 60,
        price: 5500,
        discountAmount: 0,
        finalPrice: 5500,
        taxIncluded: true,
        isCompleted: false,
        completedAt: null,
        notes: null,
        sortOrder: 0,
      },
      {
        id: 'f4c27a0d-9b1f-4d02-9a1e-df0b6c9dbef8',
        serviceId: color?.id ?? '',
        staffId: null,
        startTime: moment(120),
        endTime: moment(180),
        duration: 60,
        price: 8800,
        discountAmount: 0,
        finalPrice: 8800,
        taxIncluded: true,
        isCompleted: false,
        completedAt: null,
        notes: null,
        sortOrder: 1,
      },
    ],
    staff,
    services,
    timezone: salon.timezone,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Where the lines would be: an hour later, the first with another member, the second with nobody */
export const Moved: Story = {}

/** A line of a service the menu no longer has, by a member the salon no longer shows */
export const OfWhatIsGone: Story = {
  args: {
    lines: (meta.args?.lines ?? []).slice(0, 1).map((line) => ({
      ...line,
      serviceId: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9f09',
      staffId: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9e09',
    })),
  },
}

/** The API refused the move: the member of the first line is taken by another booking */
export const Taken: Story = {
  args: {
    checks: [
      {
        type: 'taken',
        overlapping: [
          aBooking({
            id: 'c1f94d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
            bookingNumber: 'BK-9QWE-3RTY',
            staffId: misaki?.id ?? '',
            startTime: moment(90),
            endTime: moment(150),
          }),
        ],
      },
      { type: 'unassigned' },
    ],
  },
}
