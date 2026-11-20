import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  aCustomer,
  salon,
  services,
  staff,
} from '../../../bookings/components/examples'
import { CustomerStatistics } from './customer-statistics'

const [cut, color] = services
const [misaki, ken] = staff

const meta: Meta<typeof CustomerStatistics> = {
  title: 'Admin/Customers/CustomerStatistics',
  component: CustomerStatistics,
  args: {
    statistics: {
      customerId: aCustomer().id,
      salonId: salon.id,
      startDate: '2025-11-20',
      endDate: '2026-11-20',
      totalBookings: 0,
      totalSpent: 0,
      averageBookingValue: 0,
      lastVisit: null,
      favoriteServices: [],
      favoriteStaff: [],
      loyaltyPoints: 0,
      customerSince: '2026-01-10T00:00:00.000Z',
      cancellationRate: 0,
      noShowRate: 0,
    },
    timezone: salon.timezone,
    currency: salon.currency,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A customer who has not booked at the salon in the period */
export const NoBooking: Story = {}

/** A customer who came often */
export const Regular: Story = {
  args: {
    statistics: {
      customerId: aCustomer().id,
      salonId: salon.id,
      startDate: '2025-11-20',
      endDate: '2026-11-20',
      totalBookings: 8,
      totalSpent: 52800,
      averageBookingValue: 7542,
      lastVisit: '2026-11-18T01:00:00.000Z',
      favoriteServices: [
        { serviceId: cut?.id ?? '', name: cut?.name ?? '', bookingCount: 6 },
        {
          serviceId: color?.id ?? '',
          name: color?.name ?? '',
          bookingCount: 2,
        },
      ],
      favoriteStaff: [
        {
          staffId: misaki?.id ?? '',
          displayName: misaki?.displayName ?? '',
          bookingCount: 5,
        },
        {
          staffId: ken?.id ?? '',
          displayName: ken?.displayName ?? '',
          bookingCount: 2,
        },
      ],
      loyaltyPoints: 1250,
      customerSince: '2026-01-10T00:00:00.000Z',
      cancellationRate: 12.5,
      noShowRate: 0,
    },
  },
}
