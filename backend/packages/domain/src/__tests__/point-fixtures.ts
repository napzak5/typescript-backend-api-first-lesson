import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { PointUseCaseDependencies } from '../business-logic/point'
import type {
  ApiPointAdjustRequest,
  ApiPointEarnRequest,
  ApiPointTransactionResponse,
  ApiPointUseRequest,
  DbPointTransaction,
} from '../models/point'
import type {
  IPointRepository,
  PointExpiryOutcome,
  PointListing,
  PointRecording,
} from '../repositories/point.repository'
import { CUSTOMER_ID } from './auth-fixtures'
import { SALE_ID } from './sale-fixtures'

export const POINT_TRANSACTION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f4a01'
export const OTHER_POINT_TRANSACTION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f4a02'

/** The moment of the use cases: 2026-11-20, noon in Tokyo. */
const POINT_NOW = new Date('2026-11-20T03:00:00.000Z')

/** A request that satisfies every rule: 120 points for the sale, for a year. */
export const pointEarnRequest = (
  overrides: Partial<ApiPointEarnRequest> = {},
): ApiPointEarnRequest => ({
  customerId: CUSTOMER_ID,
  points: 120,
  description: 'お会計 12,650 円',
  referenceType: 'sale',
  referenceId: SALE_ID,
  expiryDate: '2027-11-30',
  ...overrides,
})

/** A request that satisfies every rule: 500 points for the sale. */
export const pointUseRequest = (
  overrides: Partial<ApiPointUseRequest> = {},
): ApiPointUseRequest => ({
  customerId: CUSTOMER_ID,
  points: 500,
  description: null,
  referenceType: 'sale',
  referenceId: SALE_ID,
  ...overrides,
})

/** A request that satisfies every rule: 300 points taken back by hand. */
export const pointAdjustRequest = (
  overrides: Partial<ApiPointAdjustRequest> = {},
): ApiPointAdjustRequest => ({
  customerId: CUSTOMER_ID,
  points: -300,
  description: '取り消した売上の付与を戻す',
  referenceType: null,
  referenceId: null,
  ...overrides,
})

/** The point transaction the earning above writes, as stored. */
export const dbPointTransaction = (
  overrides: Partial<DbPointTransaction> = {},
): DbPointTransaction => ({
  id: POINT_TRANSACTION_ID,
  customerId: CUSTOMER_ID,
  transactionType: 'earned',
  points: 120,
  balance: 2620,
  description: 'お会計 12,650 円',
  referenceType: 'sale',
  referenceId: SALE_ID,
  expiryDate: '2027-11-30',
  createdAt: '2026-11-20 12:00:00.123456+09',
  ...overrides,
})

/** The point transaction above as the API presents it. */
export const apiPointTransaction = (
  overrides: Partial<ApiPointTransactionResponse> = {},
): ApiPointTransactionResponse => ({
  id: POINT_TRANSACTION_ID,
  customerId: CUSTOMER_ID,
  transactionType: 'earned',
  points: 120,
  balance: 2620,
  description: 'お会計 12,650 円',
  referenceType: 'sale',
  referenceId: SALE_ID,
  expiryDate: '2027-11-30',
  createdAt: '2026-11-20T03:00:00.123Z',
  ...overrides,
})

/**
 * Everything the point use cases need: a repository that answers a balance
 * of 2,620 points, a page of the point transaction of the fixtures and
 * records it for every request, finds it as the only transaction of the
 * customer and expires 120 points of one customer, and the clock of the
 * fixtures; a test overrides what it needs.
 */
export const pointDependencies = (
  overrides: Partial<IPointRepository> = {},
  now: Date = POINT_NOW,
): PointUseCaseDependencies => ({
  pointRepository: {
    balanceOf: vi.fn(async () => Result.success<number | null>(2620)),
    list: vi.fn(async () =>
      Result.success<PointListing>({
        type: 'listed',
        transactions: [dbPointTransaction()],
        total: 1,
        hasMore: false,
      }),
    ),
    record: vi.fn(async () =>
      Result.success<PointRecording>({
        type: 'recorded',
        transaction: dbPointTransaction(),
      }),
    ),
    transactionsOf: vi.fn(async () =>
      Result.success<DbPointTransaction[] | null>([dbPointTransaction()]),
    ),
    expire: vi.fn(async () =>
      Result.success<PointExpiryOutcome>({
        type: 'expired',
        processedCount: 1,
        totalPoints: 120,
      }),
    ),
    ...overrides,
  },
  clock: () => now,
})
