import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'

export interface PaymentMethodSeedResult {
  paymentMethodIds: string[]
  paymentMethodMap: Record<string, string[]> // salonId -> paymentMethodIds
}

/**
 * The payment methods of every salon. Each row is one that the API could
 * have written: nothing is stored for the settings of a payment processor
 * (`processorConfig`), which no operation reads or writes.
 */
export async function seedPaymentMethods(
  db: PostgresJsDatabase<typeof schema>,
  salonIds: string[],
): Promise<PaymentMethodSeedResult> {
  const paymentMethods: (typeof schema.paymentMethods.$inferInsert)[] = []

  for (const salonId of salonIds) {
    paymentMethods.push(
      {
        salonId,
        method: 'cash',
        displayName: 'Cash',
        description: 'Cash payment at the salon',
        fee: '0.00',
        isOnlineEnabled: false,
        isOfflineEnabled: true,
        sortOrder: 1,
        isActive: true,
      },
      {
        salonId,
        method: 'credit_card',
        displayName: 'Credit Card',
        description: 'Visa, MasterCard, JCB, AMEX accepted',
        processorName: 'Stripe',
        fee: '3.60',
        minimumAmount: 1000,
        isOnlineEnabled: true,
        isOfflineEnabled: true,
        sortOrder: 2,
        isActive: true,
      },
      {
        salonId,
        method: 'debit_card',
        displayName: 'Debit Card',
        description: 'Bank debit cards accepted',
        processorName: 'Stripe',
        fee: '2.90',
        minimumAmount: 1000,
        isOnlineEnabled: true,
        isOfflineEnabled: true,
        sortOrder: 3,
        isActive: true,
      },
      {
        salonId,
        method: 'e_money',
        displayName: 'E-Money (IC Card)',
        description: 'Suica, PASMO, iD, QUICPay accepted',
        processorName: 'Square',
        fee: '3.25',
        maximumAmount: 20000,
        isOnlineEnabled: false,
        isOfflineEnabled: true,
        sortOrder: 4,
        isActive: true,
      },
      {
        salonId,
        method: 'qr_payment',
        displayName: 'QR Code Payment',
        description: 'PayPay, LINE Pay, Rakuten Pay accepted',
        processorName: 'PayPay',
        fee: '2.95',
        isOnlineEnabled: true,
        isOfflineEnabled: true,
        sortOrder: 5,
        isActive: true,
      },
      {
        salonId,
        method: 'bank_transfer',
        displayName: 'Bank Transfer',
        description: 'Advance payment via bank transfer',
        fee: '0.00',
        minimumAmount: 10000,
        isOnlineEnabled: true,
        isOfflineEnabled: false,
        sortOrder: 6,
        isActive: true,
      },
      {
        salonId,
        method: 'point',
        displayName: 'Point Payment',
        description: 'Pay with accumulated loyalty points',
        fee: '0.00',
        minimumAmount: 100,
        isOnlineEnabled: true,
        isOfflineEnabled: true,
        sortOrder: 7,
        isActive: true,
      },
    )
  }

  const methods = await db
    .insert(schema.paymentMethods)
    .values(paymentMethods)
    .returning({
      id: schema.paymentMethods.id,
      salonId: schema.paymentMethods.salonId,
    })

  // Build payment method map
  const paymentMethodMap: Record<string, string[]> = {}
  for (const method of methods) {
    if (!paymentMethodMap[method.salonId]) {
      paymentMethodMap[method.salonId] = []
    }
    const methodList = paymentMethodMap[method.salonId]
    if (methodList) {
      methodList.push(method.id)
    }
  }

  return {
    paymentMethodIds: methods.map((m) => m.id),
    paymentMethodMap,
  }
}
