import { randomUUID } from 'node:crypto'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import { SALON_KEYS, type SalonKey, type SeededSalons } from './salons'

/** The products of each salon, by code. */
interface ProductCodes {
  readonly tokyo:
    | 'SHMP001'
    | 'COND001'
    | 'TREAT001'
    | 'COLOR001'
    | 'BLEACH001'
    | 'DEVELOPER001'
    | 'WAX001'
  readonly osaka: 'SPA001' | 'SPA002'
}

/** The products the first salon keeps a row of stock of. */
export type StockedCode = Exclude<ProductCodes['tokyo'], 'WAX001'>

/** A product of the seed, at the price it is bought at. */
type SeededProduct = Omit<
  typeof schema.products.$inferInsert,
  'id' | 'salonId' | 'productCode' | 'name' | 'unit' | 'purchasePrice'
> & {
  readonly id: string
  readonly name: string
  readonly unit: string
  readonly purchasePrice: number
}

type SeededProducts = {
  readonly [S in SalonKey]: { readonly [C in ProductCodes[S]]: SeededProduct }
}

/** A row of stock of the first salon, as a treatment that uses it names it. */
interface SeededStock {
  readonly inventoryId: string
  readonly productId: string
  readonly unit: string
  readonly lotNumber: string
}

export type SeededStockRows = Readonly<Record<StockedCode, SeededStock>>

const productsOf = (): SeededProducts => ({
  tokyo: {
    SHMP001: {
      id: randomUUID(),
      name: 'Professional Shampoo 500ml',
      description: 'Salon-grade moisturizing shampoo for all hair types',
      category: 'Hair Care',
      brand: 'Salon Pro',
      supplier: 'Tokyo Beauty Supply',
      leadTimeDays: 7,
      purchasePrice: 1500,
      retailPrice: 3500,
      salonPrice: 3000,
      unit: 'bottle',
      minimumStock: '5',
      maximumStock: '50',
      reorderPoint: '10',
      imageUrl: 'https://example.com/images/products/shampoo-001.jpg',
      barcode: '4901234567890',
      isForSale: true,
      isForTreatment: true,
      requiresLotTracking: true,
      expiryMonths: 36,
      storageConditions: 'Store in cool, dry place',
      isActive: true,
    },
    COND001: {
      id: randomUUID(),
      name: 'Professional Conditioner 500ml',
      description: 'Deep conditioning treatment for damaged hair',
      category: 'Hair Care',
      brand: 'Salon Pro',
      supplier: 'Tokyo Beauty Supply',
      leadTimeDays: 7,
      purchasePrice: 1500,
      retailPrice: 3500,
      salonPrice: 3000,
      unit: 'bottle',
      minimumStock: '5',
      maximumStock: '50',
      reorderPoint: '10',
      barcode: '4901234567891',
      isForSale: true,
      isForTreatment: true,
      requiresLotTracking: true,
      expiryMonths: 36,
      isActive: true,
    },
    TREAT001: {
      id: randomUUID(),
      name: 'Intensive Hair Mask 250ml',
      description: 'Weekly intensive treatment for dry and damaged hair',
      category: 'Hair Treatment',
      brand: 'Salon Pro',
      supplier: 'Tokyo Beauty Supply',
      leadTimeDays: 7,
      purchasePrice: 2000,
      retailPrice: 4500,
      salonPrice: 4000,
      unit: 'jar',
      minimumStock: '3',
      maximumStock: '30',
      reorderPoint: '5',
      barcode: '4901234567892',
      isForSale: true,
      isForTreatment: true,
      requiresLotTracking: true,
      expiryMonths: 24,
      isActive: true,
    },
    COLOR001: {
      id: randomUUID(),
      name: 'Hair Color - Natural Brown',
      description: 'Professional hair color with ammonia-free formula',
      category: 'Hair Color',
      brand: 'ColorTech',
      supplier: 'ColorTech Japan',
      leadTimeDays: 14,
      purchasePrice: 800,
      retailPrice: 2000,
      salonPrice: 1800,
      unit: 'tube',
      minimumStock: '10',
      maximumStock: '100',
      reorderPoint: '20',
      barcode: '4901234567893',
      isForSale: false,
      isForTreatment: true,
      requiresLotTracking: true,
      expiryMonths: 18,
      storageConditions: 'Store away from direct sunlight',
      safetyDataSheet: 'https://example.com/docs/sds/color-001.pdf',
      isActive: true,
    },
    BLEACH001: {
      id: randomUUID(),
      name: 'Lightening Powder 500g',
      description: 'Professional bleaching powder for highlights',
      category: 'Hair Color',
      brand: 'ColorTech',
      supplier: 'ColorTech Japan',
      leadTimeDays: 14,
      purchasePrice: 1200,
      retailPrice: 3000,
      salonPrice: 2800,
      unit: 'box',
      minimumStock: '5',
      maximumStock: '30',
      reorderPoint: '8',
      barcode: '4901234567894',
      isForSale: false,
      isForTreatment: true,
      requiresLotTracking: true,
      expiryMonths: 24,
      storageConditions: 'Keep in airtight container',
      safetyDataSheet: 'https://example.com/docs/sds/bleach-001.pdf',
      isActive: true,
    },
    DEVELOPER001: {
      id: randomUUID(),
      name: 'Developer 6% 1000ml',
      description: 'Hydrogen peroxide developer for hair color',
      category: 'Hair Color',
      brand: 'ColorTech',
      supplier: 'ColorTech Japan',
      leadTimeDays: 14,
      purchasePrice: 500,
      retailPrice: 1200,
      salonPrice: 1000,
      unit: 'bottle',
      minimumStock: '10',
      maximumStock: '50',
      reorderPoint: '15',
      barcode: '4901234567895',
      isForSale: false,
      isForTreatment: true,
      requiresLotTracking: true,
      expiryMonths: 12,
      storageConditions: 'Store in cool place, avoid heat',
      safetyDataSheet: 'https://example.com/docs/sds/developer-001.pdf',
      isActive: true,
    },
    WAX001: {
      id: randomUUID(),
      name: 'Styling Wax 80g',
      description: 'Medium hold styling wax for all hair types',
      category: 'Styling',
      brand: 'Style Master',
      supplier: 'Tokyo Beauty Supply',
      leadTimeDays: 7,
      purchasePrice: 800,
      retailPrice: 2000,
      salonPrice: 1800,
      unit: 'jar',
      minimumStock: '5',
      maximumStock: '40',
      reorderPoint: '10',
      barcode: '4901234567896',
      isForSale: true,
      isForTreatment: false,
      requiresLotTracking: false,
      expiryMonths: 36,
      isActive: true,
    },
  },
  osaka: {
    SPA001: {
      id: randomUUID(),
      name: 'Scalp Treatment Oil 100ml',
      description: 'Aromatherapy oil for scalp massage',
      category: 'Spa',
      brand: 'Spa Essence',
      purchasePrice: 2000,
      retailPrice: 5000,
      salonPrice: 4500,
      unit: 'bottle',
      minimumStock: '3',
      maximumStock: '20',
      reorderPoint: '5',
      barcode: '4901234567897',
      isForSale: true,
      isForTreatment: true,
      requiresLotTracking: true,
      expiryMonths: 24,
      storageConditions: 'Store in dark place at room temperature',
      isActive: true,
    },
    SPA002: {
      id: randomUUID(),
      name: 'Relaxing Head Spa Cream 250ml',
      description: 'Cooling cream for head spa treatments',
      category: 'Spa',
      brand: 'Spa Essence',
      purchasePrice: 1800,
      retailPrice: 4000,
      salonPrice: 3600,
      unit: 'jar',
      minimumStock: '5',
      maximumStock: '30',
      reorderPoint: '8',
      barcode: '4901234567898',
      isForSale: false,
      isForTreatment: true,
      requiresLotTracking: true,
      expiryMonths: 18,
      isActive: true,
    },
  },
})

const stockOf = ({ id, unit }: SeededProduct): SeededStock => ({
  inventoryId: randomUUID(),
  productId: id,
  unit,
  lotNumber: `LOT-2024-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`,
})

export async function seedProducts(
  db: PostgresJsDatabase<typeof schema>,
  salons: SeededSalons,
): Promise<SeededStockRows> {
  const products = productsOf()
  await db.insert(schema.products).values(
    SALON_KEYS.flatMap((salon) =>
      Object.entries(products[salon]).map(([productCode, product]) => ({
        ...product,
        salonId: salons[salon].id,
        productCode,
      })),
    ),
  )

  // Create initial inventory for products
  const stock: SeededStockRows = {
    SHMP001: stockOf(products.tokyo.SHMP001),
    COND001: stockOf(products.tokyo.COND001),
    TREAT001: stockOf(products.tokyo.TREAT001),
    COLOR001: stockOf(products.tokyo.COLOR001),
    BLEACH001: stockOf(products.tokyo.BLEACH001),
    DEVELOPER001: stockOf(products.tokyo.DEVELOPER001),
  }
  const rows = await db
    .insert(schema.inventory)
    .values(
      Object.values(stock).map(({ inventoryId, productId, lotNumber }) => ({
        id: inventoryId,
        salonId: salons.tokyo.id,
        productId,
        currentStock: '20.00',
        availableStock: '20.00',
        reservedStock: '0.00',
        lotNumber,
        expiryDate: '2025-12-31',
        location: 'Storage Room A',
        shelf: `A-${Math.floor(Math.random() * 10) + 1}`,
      })),
    )
    .returning()
  // Each row's history begins with the stock it starts with, as the
  // migration that began recording movements opened the rows it found.
  await db.insert(schema.inventoryTransactions).values(
    rows.map((row): typeof schema.inventoryTransactions.$inferInsert => ({
      salonId: row.salonId,
      productId: row.productId,
      inventoryId: row.id,
      transactionType: 'adjustment',
      quantity: row.currentStock,
      balanceBefore: '0.00',
      balanceAfter: row.currentStock,
      lotNumber: row.lotNumber,
      expiryDate: row.expiryDate,
      reason: '在庫移動の記録を始めた時点の在庫数',
    })),
  )
  await seedPurchaseOrders(db, salons.tokyo.id, products, stock)

  return stock
}

/**
 * Two orders of the salon of the first stock rows, entered by an
 * administrator: one waiting for approval and one placed with the supplier.
 * The amounts are worked out as the server does: each item at its quantity
 * times the purchase price, rounded to the yen, and 10% of tax.
 */
const seedPurchaseOrders = async (
  db: PostgresJsDatabase<typeof schema>,
  salonId: string,
  products: SeededProducts,
  stock: SeededStockRows,
): Promise<void> => {
  const itemOf = (code: StockedCode, quantity: number, sortOrder: number) => {
    const { name, unit, purchasePrice } = products.tokyo[code]
    return {
      inventoryId: stock[code].inventoryId,
      productCode: code,
      productName: name,
      quantity: quantity.toFixed(2),
      unit,
      unitPrice: purchasePrice,
      totalPrice: Math.round(purchasePrice * quantity),
      notes: null,
      sortOrder,
    }
  }
  const now = new Date().toISOString()
  const orders: {
    order: Omit<
      typeof schema.purchaseOrders.$inferInsert,
      'id' | 'subtotal' | 'taxAmount' | 'totalAmount'
    > & { id: string }
    items: ReturnType<typeof itemOf>[]
  }[] = [
    {
      order: {
        id: randomUUID(),
        salonId,
        orderNumber: 'PO-SEED-0001',
        supplier: 'Beauty Supply Tokyo',
        status: 'pending',
        shippingCost: null,
        expectedDelivery: null,
        paymentTerms: '月末締め翌月末払い',
        notes: '定期補充',
        approvedAt: null,
      },
      items: [itemOf('SHMP001', 10, 0), itemOf('COND001', 5, 1)],
    },
    {
      order: {
        id: randomUUID(),
        salonId,
        orderNumber: 'PO-SEED-0002',
        supplier: 'Beauty Supply Tokyo',
        status: 'ordered',
        shippingCost: 800,
        expectedDelivery: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        paymentTerms: '月末締め翌月末払い',
        notes: null,
        approvedAt: now,
      },
      items: [itemOf('TREAT001', 12, 0)],
    },
  ]
  for (const { order, items } of orders) {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
    const taxAmount = Math.round(subtotal * 0.1)
    await db.insert(schema.purchaseOrders).values({
      ...order,
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount + (order.shippingCost ?? 0),
    })
    await db
      .insert(schema.purchaseOrderItems)
      .values(items.map((item) => ({ ...item, purchaseOrderId: order.id })))
  }
}
