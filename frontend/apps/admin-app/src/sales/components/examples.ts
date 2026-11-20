import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentResponse,
  ModelsSaleCalculateResponse,
  ModelsSaleResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aBooking,
  customers,
  moment,
  salon,
  services,
  staff,
} from '../../bookings/components/examples'

/*
 * What the stories and the tests of the sales show: the salon, staff and
 * services of the bookings, the payment methods of the salon, and the sale
 * of a booking of the day with its payments.
 */

export { aBooking, customers, moment, salon, services, staff }

const method = (
  id: string,
  kind: ModelsPaymentMethodResponse['method'],
  displayName: string,
  changes: Partial<ModelsPaymentMethodResponse> = {},
): ModelsPaymentMethodResponse => ({
  id,
  salonId: salon.id,
  method: kind,
  displayName,
  description: null,
  processorName: null,
  fee: null,
  minimumAmount: null,
  maximumAmount: null,
  isOnlineEnabled: false,
  isOfflineEnabled: true,
  sortOrder: 0,
  isActive: true,
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
  ...changes,
})

/** Cash; a card from 1,000 yen; electronic money up to 20,000 yen; a QR payment the salon uses no more */
export const paymentMethods: ModelsPaymentMethodResponse[] = [
  method('1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', 'cash', '現金'),
  method(
    '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
    'credit_card',
    'クレジットカード',
    {
      minimumAmount: 1000,
      sortOrder: 1,
    },
  ),
  method('3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f', 'e_money', '交通系 IC', {
    maximumAmount: 20000,
    sortOrder: 2,
  }),
  method('4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f80', 'qr_payment', 'QR 決済', {
    sortOrder: 3,
    isActive: false,
  }),
]

const [cash, card] = paymentMethods
const [cut] = services
const [misaki] = staff

/** A payment of a sale, received in cash, with what a test changes of it. */
export const aPayment = (
  changes: Partial<ModelsPaymentResponse> = {},
): ModelsPaymentResponse => ({
  id: '5e6f7a8b-9c0d-4e1f-8a3b-4c5d6e7f8091',
  saleId: '6f7a8b9c-0d1e-4f2a-9b4c-5d6e7f809102',
  paymentMethodId: cash?.id ?? '',
  transactionNumber: 'PT-7KQM-4F2H',
  amount: 3000,
  status: 'completed',
  processorTransactionId: null,
  cardLastFour: null,
  cardBrand: null,
  errorCode: null,
  errorMessage: null,
  processedAt: moment(65),
  failedAt: null,
  refundedAt: null,
  refundAmount: null,
  refundReason: null,
  createdAt: moment(65),
  updatedAt: moment(65),
  ...changes,
})

/** The sale of the booking of the day: a cut, nothing received yet. */
export const aSale = (
  changes: Partial<ModelsSaleResponse> = {},
): ModelsSaleResponse => ({
  id: '6f7a8b9c-0d1e-4f2a-9b4c-5d6e7f809102',
  saleNumber: 'SL-2KQM-9F4H',
  salonId: salon.id,
  customerId: customers[0]?.id ?? null,
  staffId: misaki?.id ?? null,
  bookingId: aBooking().id,
  saleDate: '2026-11-20',
  saleTime: moment(62),
  subtotal: 5500,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 5500,
  pointsUsed: null,
  pointsEarned: null,
  paymentStatus: 'pending',
  isVoid: false,
  voidedAt: null,
  voidReason: null,
  notes: null,
  details: [
    {
      itemType: 'service',
      itemId: cut?.id ?? null,
      itemName: 'カット',
      quantity: 1,
      unitPrice: 5500,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 5500,
      staffId: misaki?.id ?? null,
      commissionRate: null,
      commissionAmount: null,
      notes: null,
      sortOrder: 0,
    },
  ],
  payments: [],
  createdAt: moment(62),
  updatedAt: moment(62),
  ...changes,
})

/** The sale, paid: 3,000 yen in cash and the rest by card. */
export const aPaidSale = (): ModelsSaleResponse =>
  aSale({
    paymentStatus: 'completed',
    payments: [
      aPayment(),
      aPayment({
        id: '7a8b9c0d-1e2f-4a3b-8c5d-6e7f80910213',
        paymentMethodId: card?.id ?? '',
        transactionNumber: 'PT-9F4H-2KQM',
        amount: 2500,
        cardLastFour: '4242',
        cardBrand: 'VISA',
        processedAt: moment(66),
        createdAt: moment(66),
        updatedAt: moment(66),
      }),
    ],
  })

/** What the cut of the booking comes to, with the kinds of payment that take it at once. */
export const aCalculation = (
  changes: Partial<ModelsSaleCalculateResponse> = {},
): ModelsSaleCalculateResponse => ({
  salonId: salon.id,
  bookingId: aBooking().id,
  breakdown: {
    subtotal: 5500,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 5500,
  },
  recommendedMethods: ['cash', 'credit_card', 'e_money'],
  ...changes,
})
