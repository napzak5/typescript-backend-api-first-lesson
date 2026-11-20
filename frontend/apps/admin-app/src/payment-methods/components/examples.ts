import type { ModelsPaymentMethodResponse } from '@beauty-salon-frontend/api-client'
import { salon } from '../../bookings/components/examples'

/*
 * The payment methods of the stories: cash, a card with a fee and a
 * smallest amount, an electronic money with a largest amount, and a bank
 * transfer the salon uses no more.
 */

const aMethod = (
  values: Partial<ModelsPaymentMethodResponse> &
    Pick<
      ModelsPaymentMethodResponse,
      'id' | 'method' | 'displayName' | 'sortOrder'
    >,
): ModelsPaymentMethodResponse => ({
  salonId: salon.id,
  description: null,
  processorName: null,
  fee: null,
  minimumAmount: null,
  maximumAmount: null,
  isOnlineEnabled: false,
  isOfflineEnabled: true,
  isActive: true,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...values,
})

export const cash = (): ModelsPaymentMethodResponse =>
  aMethod({
    id: '0b0c4a39-5b5f-4f0e-8d5a-0c0a5e0d0001',
    method: 'cash',
    displayName: '現金',
    fee: 0,
    sortOrder: 1,
  })

export const card = (): ModelsPaymentMethodResponse =>
  aMethod({
    id: '0b0c4a39-5b5f-4f0e-8d5a-0c0a5e0d0002',
    method: 'credit_card',
    displayName: 'クレジットカード（端末 1）',
    description:
      'VISA、Mastercard、JCB、American Express。\n分割払いは受け付けません。',
    processorName: '決済代行の例',
    fee: 3.24,
    minimumAmount: 1000,
    isOnlineEnabled: true,
    sortOrder: 2,
  })

export const eMoney = (): ModelsPaymentMethodResponse =>
  aMethod({
    id: '0b0c4a39-5b5f-4f0e-8d5a-0c0a5e0d0003',
    method: 'e_money',
    displayName: '交通系 IC',
    fee: 3.25,
    maximumAmount: 20000,
    sortOrder: 3,
  })

export const transfer = (): ModelsPaymentMethodResponse =>
  aMethod({
    id: '0b0c4a39-5b5f-4f0e-8d5a-0c0a5e0d0004',
    method: 'bank_transfer',
    displayName: '銀行振込',
    minimumAmount: 10000,
    maximumAmount: 500000,
    isOnlineEnabled: true,
    isOfflineEnabled: false,
    sortOrder: 4,
    isActive: false,
  })

export const METHODS_OF_THE_SALON: readonly ModelsPaymentMethodResponse[] = [
  cash(),
  card(),
  eMoney(),
  transfer(),
]
