import type {
  ModelsCustomerHistoryEntryResponse,
  ModelsCustomerVersionResponse,
  ModelsPointExpiringResponse,
  ModelsPointTransactionResponse,
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

/** A sale of the examples the points were given for */
export const SALE_GIVEN_FOR = '6f7a8b9c-0d1e-4f2a-9b4c-5d6e7f809102'

/** A sale of the examples the points were used for */
const SALE_USED_FOR = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

/** The customer of the examples merged into this one */
export const MERGED_CUSTOMER = 'c19f4d70-6e8c-4adf-8dbe-0c7e3f6a8bc5'

/** A transaction of the points of the customer of the examples, with what it changes. */
export const aTransaction = (
  changes: Partial<ModelsPointTransactionResponse> = {},
): ModelsPointTransactionResponse => ({
  id: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b',
  customerId,
  transactionType: 'earned',
  points: 500,
  balance: 2500,
  description: 'カットのお会計',
  referenceType: 'sale',
  referenceId: SALE_GIVEN_FOR,
  expiryDate: '2026-12-10',
  createdAt: '2026-11-10T03:00:00.000Z',
  ...changes,
})

/**
 * The transactions of the customer of the examples, the latest first: a
 * point of every kind, the balance the ledger began with, points given and
 * used at the counter, an adjustment, points moved from a customer merged
 * into this one, and points expired.
 */
export const transactions: ModelsPointTransactionResponse[] = [
  aTransaction({
    id: 'f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f7a8b9c',
    transactionType: 'expired',
    points: -100,
    balance: 2700,
    description: null,
    referenceType: null,
    referenceId: null,
    expiryDate: null,
    createdAt: '2026-11-20T00:00:00.000Z',
  }),
  aTransaction({
    id: 'e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7a8b',
    transactionType: 'transferred',
    points: 800,
    balance: 2800,
    description: null,
    referenceType: 'customer',
    referenceId: MERGED_CUSTOMER,
    expiryDate: '2027-03-31',
    createdAt: '2026-11-19T06:00:00.000Z',
  }),
  aTransaction({
    id: 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a',
    transactionType: 'adjusted',
    points: -200,
    balance: 2000,
    description: '付与の誤りを打ち消す',
    referenceType: null,
    referenceId: null,
    expiryDate: null,
    createdAt: '2026-11-18T01:00:00.000Z',
  }),
  aTransaction({
    id: 'c3d4e5f6-a7b8-4c9d-9e0f-1a2b3c4d5e6f',
    transactionType: 'used',
    points: -300,
    balance: 2200,
    description: null,
    referenceId: SALE_USED_FOR,
    expiryDate: null,
    createdAt: '2026-11-15T05:30:00.000Z',
  }),
  aTransaction(),
  aTransaction({
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    transactionType: 'adjusted',
    points: 2000,
    balance: 2000,
    description: 'ポイント台帳の開始残高',
    referenceType: null,
    referenceId: null,
    expiryDate: null,
    createdAt: '2026-11-01T00:00:00.000Z',
  }),
]

/**
 * The points of the customer of the examples that expire within 30 days:
 * points given at the counter, and points that expired yesterday and were
 * not yet taken away.
 */
export const expiring: ModelsPointExpiringResponse = {
  customerId,
  expiringPoints: 700,
  expirationDate: '2026-11-19',
  transactions: [
    aTransaction({
      id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      points: 200,
      balance: 1500,
      description: '紹介のお礼',
      referenceType: null,
      referenceId: null,
      expiryDate: '2026-11-19',
      createdAt: '2026-05-19T02:00:00.000Z',
    }),
    aTransaction(),
  ],
}
