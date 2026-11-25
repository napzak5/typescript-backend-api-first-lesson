import { describe, expect, it } from 'vitest'
import {
  type CatalogFacts,
  canonicalizeRelations,
  canonicalizeSchema,
} from '../canonicalize-introspection'

const schemaHeader = `import { sql } from 'drizzle-orm'
import { foreignKey, index, pgEnum, pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

`

const stockTable = `export const stock = pgTable(
  'stock',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    productId: uuid('product_id').notNull(),
    lotNumber: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'stock_salon_id_fk',
    }).onDelete('cascade'),
    unique('stock_unique').on(
      table.lotNumber,
      table.productId,
      table.salonId,
    ),
    index('idx_stock_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('stock_lot_unique')
      .using(
        'btree',
        table.salonId.asc().nullsLast().op('uuid_ops'),
        table.lotNumber.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql\`("lotNumber" IS NOT NULL)\`),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: 'stock_product_id_fk',
    }).onDelete('cascade'),
  ],
)`

const salonsTable = `export const salons = pgTable('salons', {
  id: uuid().defaultRandom().primaryKey().notNull(),
})`

const statusEnum = `export const stockStatus = pgEnum('stock_status', ['in', 'out'])`

const catalog: CatalogFacts = {
  uniqueColumns: new Map([
    ['stock.stock_unique', ['salonId', 'product_id', 'lotNumber']],
  ]),
  indexOperatorClasses: new Map([
    ['stock.idx_stock_salon_id', ['uuid_ops']],
    ['stock.stock_lot_unique', ['uuid_ops', 'text_ops']],
  ]),
}

const withUniqueColumns = (
  uniqueColumns: CatalogFacts['uniqueColumns'],
): CatalogFacts => ({ ...catalog, uniqueColumns })

const withIndexOperatorClasses = (
  indexOperatorClasses: CatalogFacts['indexOperatorClasses'],
): CatalogFacts => ({ ...catalog, indexOperatorClasses })

const schemaSource = `${schemaHeader}${stockTable}\n\n${statusEnum}\n\n${salonsTable}\n`

describe('canonicalizeSchema', () => {
  it('should place enums before tables and sort each group by name', () => {
    const result = canonicalizeSchema(schemaSource, catalog)

    expect(result).toMatchObject({ type: 'success' })
    const declarations = Array.from(
      (result.type === 'success' ? result.data : '').matchAll(
        /^export const (\w+)/gm,
      ),
      (match) => match[1],
    )
    expect(declarations).toEqual(['stockStatus', 'salons', 'stock'])
  })

  it('should sort the constraints of a table by kind and name', () => {
    const result = canonicalizeSchema(schemaSource, catalog)

    const names = Array.from(
      (result.type === 'success' ? result.data : '').matchAll(
        /'(stock_\w+_fk|idx_stock_\w+|stock_unique)'/g,
      ),
      (match) => match[1],
    )
    expect(names).toEqual([
      'stock_product_id_fk',
      'stock_salon_id_fk',
      'idx_stock_salon_id',
      'stock_unique',
    ])
  })

  it('should list unique constraint columns in database order', () => {
    const result = canonicalizeSchema(schemaSource, catalog)

    expect(result.type === 'success' ? result.data : '').toContain(
      "unique('stock_unique').on(table.salonId, table.productId, table.lotNumber)",
    )
  })

  it('should keep the header and every declaration line', () => {
    const result = canonicalizeSchema(schemaSource, catalog)

    const output = result.type === 'success' ? result.data : ''
    expect(output.startsWith(schemaHeader)).toBe(true)
    expect(output).toContain(salonsTable)
    expect(output).toContain(statusEnum)
  })

  it('should be idempotent', () => {
    const first = canonicalizeSchema(schemaSource, catalog)
    const second = canonicalizeSchema(
      first.type === 'success' ? first.data : '',
      catalog,
    )

    expect(second).toEqual(first)
  })

  it('should fail when a unique constraint is unknown to the database', () => {
    const result = canonicalizeSchema(
      schemaSource,
      withUniqueColumns(new Map()),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: expect.stringContaining('stock_unique'),
    })
  })

  it('should fail when a unique constraint has different columns in the database', () => {
    const result = canonicalizeSchema(
      schemaSource,
      withUniqueColumns(
        new Map([['stock.stock_unique', ['salonId', 'product_id']]]),
      ),
    )

    expect(result).toMatchObject({ type: 'error' })
  })

  it('should fail when a unique constraint refers to an unknown column', () => {
    const result = canonicalizeSchema(
      schemaSource,
      withUniqueColumns(
        new Map([['stock.stock_unique', ['salonId', 'product_id', 'missing']]]),
      ),
    )

    expect(result).toMatchObject({ type: 'error' })
  })

  it('should fail when a constraint cannot be identified', () => {
    const anonymous = stockTable.replace(
      "name: 'stock_salon_id_fk',",
      'name: constraintName,',
    )

    const result = canonicalizeSchema(`${schemaHeader}${anonymous}\n`, catalog)

    expect(result).toMatchObject({
      type: 'error',
      error: expect.stringContaining('Cannot identify the constraint'),
    })
  })

  it('should return a source without declarations unchanged', () => {
    const result = canonicalizeSchema(schemaHeader, catalog)

    expect(result).toEqual({ type: 'success', data: schemaHeader })
  })

  it('should leave a list of constraints that does not end as it is', () => {
    // Arrange
    const unended = `${schemaHeader}export const visits = pgTable(
  'visits',
  {
    id: uuid().primaryKey().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [salons.id],
      name: 'visits_salon_id_fk',
    }),
`

    // Act
    const result = canonicalizeSchema(unended, catalog)

    // Assert
    expect(result).toEqual({ type: 'success', data: unended })
  })

  it('should give each index column the operator class the database has', () => {
    const result = canonicalizeSchema(schemaSource, catalog)

    const output = result.type === 'success' ? result.data : ''
    expect(output).toContain(
      "table.lotNumber.asc().nullsLast().op('text_ops'),",
    )
    expect(output).not.toContain(
      "table.lotNumber.asc().nullsLast().op('uuid_ops'),",
    )
  })

  it('should leave the operator classes that are right, and the rest of an index, as they are', () => {
    const result = canonicalizeSchema(schemaSource, catalog)

    const output = result.type === 'success' ? result.data : ''
    expect(output).toContain(`    index('idx_stock_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),`)
    expect(output).toContain(`    uniqueIndex('stock_lot_unique')
      .using(
        'btree',
        table.salonId.asc().nullsLast().op('uuid_ops'),
        table.lotNumber.asc().nullsLast().op('text_ops'),
      )
      .where(sql\`("lotNumber" IS NOT NULL)\`),`)
  })

  it('should fail when an index is unknown to the database', () => {
    const result = canonicalizeSchema(
      schemaSource,
      withIndexOperatorClasses(
        new Map([['stock.idx_stock_salon_id', ['uuid_ops']]]),
      ),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: expect.stringContaining('stock_lot_unique'),
    })
  })

  it('should fail when an index has another number of columns in the database', () => {
    const result = canonicalizeSchema(
      schemaSource,
      withIndexOperatorClasses(
        new Map([
          ['stock.idx_stock_salon_id', ['uuid_ops']],
          ['stock.stock_lot_unique', ['uuid_ops']],
        ]),
      ),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: expect.stringContaining(
        'introspected 2 operator class(es), database (uuid_ops)',
      ),
    })
  })

  it('should tell an index of one table from the index of the same name of another', () => {
    const result = canonicalizeSchema(
      schemaSource,
      withIndexOperatorClasses(
        new Map([
          ['stock.idx_stock_salon_id', ['uuid_ops']],
          ['salons.stock_lot_unique', ['uuid_ops', 'text_ops']],
        ]),
      ),
    )

    expect(result).toMatchObject({ type: 'error' })
  })
})

const relationsHeader = `import { relations } from 'drizzle-orm/relations'
import { products, salons, stock } from './schema'

`

const stockRelations = `export const stockRelations = relations(stock, ({ one, many }) => ({
  salon: one(salons, {
    fields: [stock.salonId],
    references: [salons.id],
  }),
  movements: many(stockMovements),
  product: one(products, {
    fields: [stock.productId],
    references: [products.id],
  }),
}))`

const salonsRelations = `export const salonsRelations = relations(salons, ({ many }) => ({
  stock: many(stock),
}))`

const wrappedRelations = `export const productCategoriesRelations = relations(
  productCategories,
  ({ one, many }) => ({
    products: many(products),
    parent: one(productCategories, {
      fields: [productCategories.parentId],
      references: [productCategories.id],
    }),
  }),
)`

const relationsSource = `${relationsHeader}${stockRelations}\n\n${salonsRelations}\n\n${wrappedRelations}\n`

describe('canonicalizeRelations', () => {
  it('should sort relation blocks by name', () => {
    const result = canonicalizeRelations(relationsSource)

    const declarations = Array.from(
      (result.type === 'success' ? result.data : '').matchAll(
        /^export const (\w+)/gm,
      ),
      (match) => match[1],
    )
    expect(declarations).toEqual([
      'productCategoriesRelations',
      'salonsRelations',
      'stockRelations',
    ])
  })

  it('should sort the relations inside each block by property name', () => {
    const result = canonicalizeRelations(relationsSource)

    const properties = Array.from(
      (result.type === 'success' ? result.data : '').matchAll(
        /^ +(\w+): (?:one|many)\(/gm,
      ),
      (match) => match[1],
    )
    expect(properties).toEqual([
      'parent',
      'products',
      'stock',
      'movements',
      'product',
      'salon',
    ])
  })

  it('should keep multi-line relations intact', () => {
    const result = canonicalizeRelations(relationsSource)

    expect(result.type === 'success' ? result.data : '').toContain(
      `  product: one(products, {
    fields: [stock.productId],
    references: [products.id],
  }),`,
    )
  })

  it('should be idempotent', () => {
    const first = canonicalizeRelations(relationsSource)
    const second = canonicalizeRelations(
      first.type === 'success' ? first.data : '',
    )

    expect(second).toEqual(first)
  })

  it('should return a source without relations unchanged', () => {
    // Act
    const result = canonicalizeRelations(relationsHeader)

    // Assert
    expect(result).toEqual({ type: 'success', data: relationsHeader })
  })

  it('should fail when a relation cannot be identified', () => {
    const result = canonicalizeRelations(
      `${relationsHeader}${salonsRelations.replace('stock: many(stock),', '...shared,')}\n`,
    )

    expect(result).toMatchObject({
      type: 'error',
      error: expect.stringContaining('Cannot identify the relation'),
    })
  })
})
