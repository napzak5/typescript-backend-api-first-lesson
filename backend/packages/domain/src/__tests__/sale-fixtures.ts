import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type {
  SaleReferences,
  SaleUseCaseDependencies,
} from '../business-logic/sale'
import type {
  ApiPaymentResponse,
  ApiSaleCreateRequest,
  ApiSaleResponse,
  ApiSalesDetail,
  DbPaymentTransaction,
  DbSale,
  DbSalesDetail,
  SaleWithDetails,
} from '../models/sale'
import type {
  ISaleRepository,
  SaleCreation,
  SaleList,
} from '../repositories/sale.repository'
import { CUSTOMER_ID } from './auth-fixtures'
import { BOOKING_ID, CUT_ID } from './booking-fixtures'
import { SALON_ID } from './fixtures'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'

export const SALE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3a01'
export const OTHER_SALE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3a02'

/** A shampoo the salon sells. */
export const PRODUCT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3b01'

export const PAYMENT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3c01'
export const PAYMENT_METHOD_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3d01'

export const SALE_NUMBER = 'SL-7Z3K-0QXM'

/**
 * A request that satisfies every rule: the bill of a booking at 12:40 in
 * Tokyo, with a cut, two bottles of shampoo at a discount and a fee that
 * is of no record. Together: 12,100 yen, less 600, plus 1,150 of tax.
 */
export const saleCreateRequest = (): ApiSaleCreateRequest => ({
  salonId: SALON_ID,
  customerId: CUSTOMER_ID,
  staffId: STAFF_MEMBER_ID,
  bookingId: BOOKING_ID,
  saleTime: '2026-11-20T03:40:00Z',
  pointsUsed: 100,
  pointsEarned: 126,
  notes: '現金でお支払い',
  details: [
    {
      itemType: 'service',
      itemId: CUT_ID,
      itemName: 'カット',
      quantity: 1,
      unitPrice: 6000,
      discountAmount: 0,
      taxAmount: 600,
      totalAmount: 6600,
      staffId: STAFF_MEMBER_ID,
      commissionRate: 40,
      commissionAmount: 2400,
      notes: null,
      sortOrder: 0,
    },
    {
      itemType: 'product',
      itemId: PRODUCT_ID,
      itemName: 'シャンプー',
      quantity: 2,
      unitPrice: 2800,
      discountAmount: 600,
      taxAmount: 500,
      totalAmount: 5500,
      staffId: OTHER_STAFF_MEMBER_ID,
      commissionRate: 12.5,
      commissionAmount: 625,
      notes: 'セット割引',
      sortOrder: 1,
    },
    {
      itemType: 'fee',
      itemId: null,
      itemName: '指名料',
      quantity: 1,
      unitPrice: 500,
      discountAmount: 0,
      taxAmount: 50,
      totalAmount: 550,
      staffId: null,
      commissionRate: null,
      commissionAmount: null,
      notes: null,
      sortOrder: 2,
    },
  ],
})

/**
 * What the request above refers to: a salon in Tokyo, the customer, the two
 * staff members, the cut, the shampoo, and the booking of the customer,
 * which has no sale yet.
 */
export const saleReferences = (
  overrides: Partial<SaleReferences> = {},
): SaleReferences => ({
  salon: { timezone: 'Asia/Tokyo' },
  customerExists: true,
  staffIds: [STAFF_MEMBER_ID, OTHER_STAFF_MEMBER_ID],
  serviceIds: [CUT_ID],
  productIds: [PRODUCT_ID],
  booking: { customerId: CUSTOMER_ID, isBilled: false },
  ...overrides,
})

/** The lines of the sale below as the driver returns the rows. */
export const dbSalesDetails = (): DbSalesDetail[] => [
  {
    id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3e01',
    saleId: SALE_ID,
    itemType: 'service',
    itemId: CUT_ID,
    itemName: 'カット',
    quantity: 1,
    unitPrice: 6000,
    discountAmount: 0,
    taxAmount: 600,
    totalAmount: 6600,
    staffId: STAFF_MEMBER_ID,
    commissionRate: '40.00',
    commissionAmount: 2400,
    notes: null,
    sortOrder: 0,
    createdAt: '2026-11-20 12:41:00.123456+09',
  },
  {
    id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3e02',
    saleId: SALE_ID,
    itemType: 'product',
    itemId: PRODUCT_ID,
    itemName: 'シャンプー',
    quantity: 2,
    unitPrice: 2800,
    discountAmount: 600,
    taxAmount: 500,
    totalAmount: 5500,
    staffId: OTHER_STAFF_MEMBER_ID,
    commissionRate: '12.50',
    commissionAmount: 625,
    notes: 'セット割引',
    sortOrder: 1,
    createdAt: '2026-11-20 12:41:00.123456+09',
  },
  {
    id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3e03',
    saleId: SALE_ID,
    itemType: 'fee',
    itemId: null,
    itemName: '指名料',
    quantity: 1,
    unitPrice: 500,
    discountAmount: 0,
    taxAmount: 50,
    totalAmount: 550,
    staffId: null,
    commissionRate: null,
    commissionAmount: null,
    notes: null,
    sortOrder: 2,
    createdAt: '2026-11-20 12:41:00.123456+09',
  },
]

/** A payment of the sale below as the driver returns the row: paid by card. */
export const dbPayment = (
  overrides: Partial<DbPaymentTransaction> = {},
): DbPaymentTransaction => ({
  id: PAYMENT_ID,
  saleId: SALE_ID,
  paymentMethodId: PAYMENT_METHOD_ID,
  transactionNumber: 'TX-0001',
  amount: 12650,
  status: 'completed',
  processorTransactionId: 'ch_3Q',
  processorResponse: { approved: true },
  cardLastFour: '4242',
  cardBrand: 'visa',
  errorCode: null,
  errorMessage: null,
  processedAt: '2026-11-20 12:42:10.5+09',
  failedAt: null,
  refundedAt: null,
  refundAmount: null,
  refundReason: null,
  metadata: { terminal: 'front' },
  createdAt: '2026-11-20 12:42:00.123456+09',
  updatedAt: '2026-11-20 03:42:10.5+00',
  ...overrides,
})

/** A row of `sales` as the driver returns it: the sale of the request above. */
const dbSale = (overrides: Partial<DbSale> = {}): DbSale => ({
  id: SALE_ID,
  saleNumber: SALE_NUMBER,
  salonId: SALON_ID,
  customerId: CUSTOMER_ID,
  staffId: STAFF_MEMBER_ID,
  bookingId: BOOKING_ID,
  saleDate: '2026-11-20',
  saleTime: '2026-11-20 12:40:00+09',
  subtotal: 12100,
  discountAmount: 600,
  taxAmount: 1150,
  totalAmount: 12650,
  pointsUsed: 100,
  pointsEarned: 126,
  paymentStatus: 'pending',
  isVoid: false,
  voidedAt: null,
  voidReason: null,
  notes: '現金でお支払い',
  createdAt: '2026-11-20 12:41:00.123456+09',
  updatedAt: '2026-11-20 03:41:30+00',
  ...overrides,
})

/** The sale above with its lines and, unless a test says otherwise, no payment. */
export const saleWithDetails = (
  overrides: Partial<DbSale> = {},
  details: DbSalesDetail[] = dbSalesDetails(),
  payments: DbPaymentTransaction[] = [],
): SaleWithDetails => ({ sale: dbSale(overrides), details, payments })

/** The lines above as the API presents them. */
export const apiSalesDetails = (): ApiSalesDetail[] => [
  {
    itemType: 'service',
    itemId: CUT_ID,
    itemName: 'カット',
    quantity: 1,
    unitPrice: 6000,
    discountAmount: 0,
    taxAmount: 600,
    totalAmount: 6600,
    staffId: STAFF_MEMBER_ID,
    commissionRate: 40,
    commissionAmount: 2400,
    notes: null,
    sortOrder: 0,
  },
  {
    itemType: 'product',
    itemId: PRODUCT_ID,
    itemName: 'シャンプー',
    quantity: 2,
    unitPrice: 2800,
    discountAmount: 600,
    taxAmount: 500,
    totalAmount: 5500,
    staffId: OTHER_STAFF_MEMBER_ID,
    commissionRate: 12.5,
    commissionAmount: 625,
    notes: 'セット割引',
    sortOrder: 1,
  },
  {
    itemType: 'fee',
    itemId: null,
    itemName: '指名料',
    quantity: 1,
    unitPrice: 500,
    discountAmount: 0,
    taxAmount: 50,
    totalAmount: 550,
    staffId: null,
    commissionRate: null,
    commissionAmount: null,
    notes: null,
    sortOrder: 2,
  },
]

/** The payment above as the API presents it. */
export const apiPayment = (
  overrides: Partial<ApiPaymentResponse> = {},
): ApiPaymentResponse => ({
  id: PAYMENT_ID,
  saleId: SALE_ID,
  paymentMethodId: PAYMENT_METHOD_ID,
  transactionNumber: 'TX-0001',
  amount: 12650,
  status: 'completed',
  processorTransactionId: 'ch_3Q',
  cardLastFour: '4242',
  cardBrand: 'visa',
  errorCode: null,
  errorMessage: null,
  processedAt: '2026-11-20T03:42:10.500Z',
  failedAt: null,
  refundedAt: null,
  refundAmount: null,
  refundReason: null,
  createdAt: '2026-11-20T03:42:00.123Z',
  updatedAt: '2026-11-20T03:42:10.500Z',
  ...overrides,
})

/** The sale above as the API presents it. */
export const apiSale = (
  overrides: Partial<ApiSaleResponse> = {},
): ApiSaleResponse => ({
  id: SALE_ID,
  saleNumber: SALE_NUMBER,
  salonId: SALON_ID,
  customerId: CUSTOMER_ID,
  staffId: STAFF_MEMBER_ID,
  bookingId: BOOKING_ID,
  saleDate: '2026-11-20',
  saleTime: '2026-11-20T03:40:00.000Z',
  subtotal: 12100,
  discountAmount: 600,
  taxAmount: 1150,
  totalAmount: 12650,
  pointsUsed: 100,
  pointsEarned: 126,
  paymentStatus: 'pending',
  isVoid: false,
  voidedAt: null,
  voidReason: null,
  notes: '現金でお支払い',
  details: apiSalesDetails(),
  payments: [],
  createdAt: '2026-11-20T03:41:00.123Z',
  updatedAt: '2026-11-20T03:41:30.000Z',
  ...overrides,
})

/**
 * Everything the sale use cases need: a repository that holds the one sale
 * above and writes it for every request, and an issuer that always issues
 * the same number; a test overrides what it needs.
 */
export const saleDependencies = (
  overrides: Partial<ISaleRepository> = {},
  numbers: string[] = [],
): SaleUseCaseDependencies => {
  const upcoming = [...numbers]

  return {
    saleRepository: {
      create: vi.fn(async () =>
        Result.success<SaleCreation>({
          type: 'created',
          sale: saleWithDetails(),
        }),
      ),
      findById: vi.fn(async () =>
        Result.success<SaleWithDetails | null>(saleWithDetails()),
      ),
      list: vi.fn(async () =>
        Result.success<SaleList | null>({
          sales: [saleWithDetails()],
          total: 1,
          hasMore: false,
        }),
      ),
      ...overrides,
    },
    saleNumberIssuer: {
      issue: vi.fn(() => upcoming.shift() ?? SALE_NUMBER),
    },
  }
}

const REPOSITORY_METHODS: (keyof ISaleRepository)[] = [
  'create',
  'findById',
  'list',
]

/** The methods of the repository that were called, in the order of the calls. */
export const saleRepositoryCalls = ({
  saleRepository,
}: SaleUseCaseDependencies): string[] =>
  REPOSITORY_METHODS.flatMap((name) =>
    vi
      .mocked(saleRepository[name])
      .mock.invocationCallOrder.map((order) => ({ order, name })),
  )
    .toSorted((a, b) => a.order - b.order)
    .map(({ name }) => name)
