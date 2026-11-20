import type {
  ModelsCustomerHistoryEntryResponse,
  ModelsCustomerVersionResponse,
} from '@beauty-salon-frontend/api-client'
import { aCustomer } from '../../bookings/components/examples'

const { id: customerId } = aCustomer()

/** The account that is signed in, in the stories */
export const ME = '6c1f0e2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b'

/** The account of the customer of the examples, in the stories */
export const CUSTOMER_ACCOUNT = '7d2a1f3b-4c5e-4f60-9b1a-2c3d4e5f6a7b'

/** A version of the customer of the examples, with what it changes. */
export const aVersion = (
  changes: Partial<ModelsCustomerVersionResponse> = {},
): ModelsCustomerVersionResponse => {
  const {
    id: _id,
    userId: _userId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    firstVisitDate: _firstVisitDate,
    lastVisitDate: _lastVisitDate,
    visitCount: _visitCount,
    noShowCount: _noShowCount,
    cancellationCount: _cancellationCount,
    loyaltyPoints: _loyaltyPoints,
    ...values
  } = aCustomer()

  return {
    ...values,
    id: 'a3e5c7d9-1b2f-4a6c-8e0d-2f4b6d8a0c13',
    customerId,
    version: 2,
    operation: 'update',
    changedBy: ME,
    changedAt: '2026-11-18T05:30:00.000Z',
    ...changes,
  }
}

/** The versions of the customer of the examples, the latest first. */
export const history: readonly ModelsCustomerHistoryEntryResponse[] = [
  {
    id: '0d2f4b6d-8a0c-4e1f-9b3d-5f7a9c1e3b25',
    customerId,
    version: 4,
    operation: 'update',
    changedBy: ME,
    changedAt: '2026-11-19T01:15:00.000Z',
    changes: [
      {
        field: 'phoneNumber',
        oldValue: '090-1111-2222',
        newValue: '080-3333-4444',
      },
      { field: 'postalCode', oldValue: null, newValue: '150-0001' },
      { field: 'city', oldValue: null, newValue: '渋谷区' },
    ],
  },
  {
    id: '9c1e3b25-7d4f-4a6b-8c0e-2a4c6e8b0d37',
    customerId,
    version: 3,
    operation: 'update',
    changedBy: '2b4d6f8a-0c1e-4a3b-9d5f-7b9d1f3a5c49',
    changedAt: '2026-11-18T09:00:00.000Z',
    changes: [],
  },
  {
    id: 'a3e5c7d9-1b2f-4a6c-8e0d-2f4b6d8a0c13',
    customerId,
    version: 2,
    operation: 'update',
    changedBy: CUSTOMER_ACCOUNT,
    changedAt: '2026-11-18T05:30:00.000Z',
    changes: [
      {
        field: 'preferences',
        oldValue: null,
        newValue: { preferredServices: ['cut'], notes: null },
      },
    ],
  },
  {
    id: '5f7a9c1e-3b25-4d6f-8a0c-1e3b5d7f9a61',
    customerId,
    version: 1,
    operation: 'baseline',
    changedBy: null,
    changedAt: '2026-11-01T00:00:00.000Z',
    changes: null,
  },
]
