import { medicalCharts } from '@beauty-salon-backend/database'
import {
  type CustomerId,
  customerIdSchema,
  type DbNewMedicalChart,
  medicalChartIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { MedicalChartRepository } from '../medical-chart.repository.impl'
import { insertAllergy, insertChart, insertCustomer } from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new MedicalChartRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** A fixed ID, so that a test decides which of two charts comes first. */
const idOf = (place: number): string =>
  `00000000-0000-4000-8000-${String(place).padStart(12, '0')}`

/** The columns of a customer who was deleted on 9 December 2026. */
const DELETED = { deletedAt: '2026-12-09T05:00:00Z' }

const storedCustomer = async (
  overrides: Parameters<typeof insertCustomer>[1] = {},
): Promise<CustomerId> =>
  customerIdSchema.parse(
    (await insertCustomer(databases.database(), overrides)).id,
  )

const storedChart = async (
  overrides: Parameters<typeof insertChart>[2] = {},
  customer: Parameters<typeof insertCustomer>[1] = {},
) =>
  insertChart(databases.database(), await storedCustomer(customer), overrides)

/** The rows of the charts of the customer in the table. */
const chartsOf = (customerId: string) =>
  databases
    .database()
    .select()
    .from(medicalCharts)
    .where(eq(medicalCharts.customerId, customerId))

/** The row of the chart in the table, or undefined when there is none. */
const rowOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(medicalCharts)
    .where(eq(medicalCharts.id, id))
  return row
}

const newChart = (customerId: CustomerId): DbNewMedicalChart => ({
  customerId,
  previousTreatments: [
    {
      treatment: 'color',
      date: '2026-10-01',
      salonName: '青山の美容室',
      notes: '明るめのブラウン',
    },
  ],
  medicalConditions: '頭皮が敏感',
  preferredProducts: ['オーガニックシャンプー'],
  avoidProducts: ['ジアミン系の染料'],
  notes: '施術の前にパッチテスト',
})

describe('MedicalChartRepository', () => {
  describe('create', () => {
    it('should write the chart of a customer who has none, stamped once at the moment', async () => {
      // Arrange
      const customerId = await storedCustomer()
      const chart = newChart(customerId)

      // Act
      const created = await repository().create(chart)

      // Assert
      const [row] = await chartsOf(customerId)
      expect(created).toEqual({
        type: 'success',
        data: { type: 'created', chart: row },
      })
      expect(row).toMatchObject(chart)
      expect(row?.updatedAt).toBe(row?.createdAt)
    })

    it.each<[string, () => Promise<CustomerId>]>([
      ['who was deleted', () => storedCustomer(DELETED)],
      [
        'of an ID that names none',
        async () => customerIdSchema.parse(UNKNOWN_ID),
      ],
    ])('should write no chart of a customer %s', async (_case, customerOf) => {
      // Arrange
      const customerId = await customerOf()

      // Act
      const created = await repository().create(newChart(customerId))

      // Assert
      expect(created).toEqual({
        type: 'success',
        data: { type: 'customerNotFound' },
      })
      expect(await chartsOf(customerId)).toEqual([])
    })

    it('should write no second chart of a customer', async () => {
      // Arrange
      const chart = await storedChart()
      const customerId = customerIdSchema.parse(chart.customerId)

      // Act
      const created = await repository().create(newChart(customerId))

      // Assert
      expect(created).toEqual({
        type: 'success',
        data: { type: 'chartExists' },
      })
      expect(await chartsOf(customerId)).toEqual([chart])
    })

    it('should write no chart of a customer whose deletion it waited for', async () => {
      // Arrange
      const customerId = await storedCustomer()

      // Act
      const created = await databases.whileHeld(
        (held) =>
          held`select id from customers where id = ${customerId} for update`,
        (held) =>
          held`update customers set "deletedAt" = '2026-12-09T05:00:00Z' where id = ${customerId}`,
        () => repository().create(newChart(customerId)),
      )

      // Assert
      expect(created).toEqual({
        type: 'success',
        data: { type: 'customerNotFound' },
      })
      expect(await chartsOf(customerId)).toEqual([])
    })
  })

  describe('findByCustomer', () => {
    it('should find the chart of the customer', async () => {
      // Arrange
      await storedChart()
      const chart = await storedChart()

      // Act
      const found = await repository().findByCustomer(
        customerIdSchema.parse(chart.customerId),
      )

      // Assert
      expect(found).toEqual({ type: 'success', data: { type: 'found', chart } })
    })

    it('should find that a customer has no chart', async () => {
      // Arrange
      await storedChart()
      const customerId = await storedCustomer()

      // Act
      const found = await repository().findByCustomer(customerId)

      // Assert
      expect(found).toEqual({
        type: 'success',
        data: { type: 'chartNotFound' },
      })
    })

    it.each<[string, () => Promise<string>]>([
      [
        'who was deleted, and whose chart is kept',
        async () => (await storedChart({}, DELETED)).customerId,
      ],
      ['of an ID that names none', async () => UNKNOWN_ID],
    ])('should find no customer %s', async (_case, customerOf) => {
      // Arrange
      const customerId = customerIdSchema.parse(await customerOf())

      // Act
      const found = await repository().findByCustomer(customerId)

      // Assert
      expect(found).toEqual({
        type: 'success',
        data: { type: 'customerNotFound' },
      })
    })
  })

  describe('update', () => {
    it('should write the columns the changes name, with the time, and leave the rest', async () => {
      // Arrange
      const chart = await storedChart({
        medicalConditions: '頭皮が敏感',
        notes: 'メモ',
        updatedAt: '2026-12-01T00:00:00Z',
      })
      const other = await storedChart()

      // Act
      const changed = await repository().update(
        medicalChartIdSchema.parse(chart.id),
        { notes: null, avoidProducts: ['ジアミン系の染料'] },
      )

      // Assert
      const row = await rowOf(chart.id)
      expect(changed).toEqual({
        type: 'success',
        data: { type: 'changed', chart: row },
      })
      expect(row).toEqual({
        ...chart,
        notes: null,
        avoidProducts: ['ジアミン系の染料'],
        updatedAt: row?.updatedAt,
      })
      expect(row?.updatedAt).not.toBe(chart.updatedAt)
      expect(await rowOf(other.id)).toEqual(other)
    })

    it.each<[string, () => Promise<string>]>([
      [
        'of a customer who was deleted',
        async () => (await storedChart({}, DELETED)).id,
      ],
      ['of an ID that names none', async () => UNKNOWN_ID],
    ])('should change no chart %s', async (_case, chartOf) => {
      // Arrange
      const id = await chartOf()
      const before = await rowOf(id)

      // Act
      const changed = await repository().update(
        medicalChartIdSchema.parse(id),
        { notes: '変えたメモ' },
      )

      // Assert
      expect(changed).toEqual({ type: 'success', data: { type: 'notFound' } })
      expect(await rowOf(id)).toEqual(before)
    })
  })

  describe('list', () => {
    /**
     * Charts of six customers, by the time they were written: one of a
     * customer with an allergy that mentions a scalp condition, two
     * written at one moment of which the one with the greater ID comes
     * first (a preferred and an avoided product), one with a note that
     * holds a percent sign, one of a customer with an allergy, and one of
     * a customer who was deleted, which no list holds.
     */
    const storedCharts = async () => {
      const scalp = await storedChart({
        id: idOf(5),
        medicalConditions: '頭皮が乾燥している (Dry scalp)',
        createdAt: '2026-12-01T03:00:00Z',
      })
      await insertAllergy(databases.database(), scalp.customerId)
      const preferred = await storedChart({
        id: idOf(1),
        preferredProducts: ['ミルボン', 'Kushi Organic'],
        createdAt: '2026-12-02T03:00:00Z',
      })
      const avoided = await storedChart({
        id: idOf(2),
        avoidProducts: ['ジアミン系の染料'],
        createdAt: '2026-12-02T03:00:00Z',
      })
      const percent = await storedChart({
        id: idOf(3),
        notes: '白髪は 30% ほど',
        createdAt: '2026-12-03T03:00:00Z',
      })
      const allergic = await storedChart({
        id: idOf(4),
        createdAt: '2026-12-04T03:00:00Z',
      })
      await insertAllergy(databases.database(), allergic.customerId, {
        allergenName: 'ニッケル',
        allergyType: 'metal',
      })
      const ofDeleted = await storedChart(
        { id: idOf(6), notes: '頭皮', createdAt: '2026-12-05T03:00:00Z' },
        DELETED,
      )
      return { scalp, preferred, avoided, percent, allergic, ofDeleted }
    }

    type Charts = Awaited<ReturnType<typeof storedCharts>>
    type Name = Exclude<keyof Charts, 'ofDeleted'>

    it('should list the charts of the customers who are not deleted, the latest first and then the greatest ID', async () => {
      // Arrange
      const charts = await storedCharts()

      // Act
      const listed = await repository().list({
        limit: 20,
        after: null,
        search: null,
        hasAllergies: null,
      })

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: {
          type: 'listed',
          charts: [
            charts.allergic,
            charts.percent,
            charts.avoided,
            charts.preferred,
            charts.scalp,
          ],
          total: 5,
          hasMore: false,
        },
      })
    })

    it.each<[string, string | null, boolean | null, Name[]]>([
      [
        'a part of the medical conditions in another case',
        'DRY',
        null,
        ['scalp'],
      ],
      [
        'a part of the notes, a percent sign as it is',
        '30%',
        null,
        ['percent'],
      ],
      ['an underscore as it is', '_', null, []],
      ['a preferred product in another case', 'kushi', null, ['preferred']],
      ['an avoided product', 'ジアミン', null, ['avoided']],
      ['the customers with an allergy', null, true, ['allergic', 'scalp']],
      [
        'the customers without an allergy',
        null,
        false,
        ['percent', 'avoided', 'preferred'],
      ],
      ['a keyword and an allergy together', '頭皮', true, ['scalp']],
      ['a keyword and no allergy together', '頭皮', false, []],
    ])(
      'should list the charts by %s, and count them',
      async (_filter, search, hasAllergies, names) => {
        // Arrange
        const charts = await storedCharts()

        // Act
        const listed = await repository().list({
          limit: 20,
          after: null,
          search,
          hasAllergies,
        })

        // Assert
        expect(listed).toEqual({
          type: 'success',
          data: {
            type: 'listed',
            charts: names.map((name) => charts[name]),
            total: names.length,
            hasMore: false,
          },
        })
      },
    )

    it('should list a page at a time, from the chart after the cursor', async () => {
      // Arrange
      const charts = await storedCharts()

      // Act
      const second = await repository().list({
        limit: 1,
        after: medicalChartIdSchema.parse(charts.avoided.id),
        search: null,
        hasAllergies: null,
      })
      const last = await repository().list({
        limit: 1,
        after: medicalChartIdSchema.parse(charts.preferred.id),
        search: null,
        hasAllergies: null,
      })

      // Assert
      expect(second).toEqual({
        type: 'success',
        data: {
          type: 'listed',
          charts: [charts.preferred],
          total: 5,
          hasMore: true,
        },
      })
      expect(last).toEqual({
        type: 'success',
        data: {
          type: 'listed',
          charts: [charts.scalp],
          total: 5,
          hasMore: false,
        },
      })
    })

    it('should list the page after a chart the filters leave out, from its place', async () => {
      // Arrange
      const charts = await storedCharts()

      // Act
      const listed = await repository().list({
        limit: 20,
        after: medicalChartIdSchema.parse(charts.percent.id),
        search: null,
        hasAllergies: true,
      })

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: {
          type: 'listed',
          charts: [charts.scalp],
          total: 2,
          hasMore: false,
        },
      })
    })

    it.each<[string, (charts: Charts) => string]>([
      [
        'the chart of a customer who was deleted',
        (charts) => charts.ofDeleted.id,
      ],
      ['an ID that names no chart', () => UNKNOWN_ID],
    ])('should list no page after %s', async (_cursor, cursorOf) => {
      // Arrange
      const charts = await storedCharts()

      // Act
      const listed = await repository().list({
        limit: 20,
        after: medicalChartIdSchema.parse(cursorOf(charts)),
        search: null,
        hasAllergies: null,
      })

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: { type: 'cursorNotFound' },
      })
    })
  })
})

describe('MedicalChartRepository when the database is gone', () => {
  const customerId = customerIdSchema.parse(UNKNOWN_ID)

  it.each<[string, string, (gone: MedicalChartRepository) => Promise<unknown>]>(
    [
      [
        'a creation',
        'Failed to create medical chart',
        (gone) => gone.create(newChart(customerId)),
      ],
      [
        'the chart of a customer',
        'Failed to find medical chart',
        (gone) => gone.findByCustomer(customerId),
      ],
      [
        'a change',
        'Failed to update medical chart',
        (gone) =>
          gone.update(medicalChartIdSchema.parse(UNKNOWN_ID), { notes: null }),
      ],
      [
        'the charts',
        'Failed to list medical charts',
        (gone) =>
          gone.list({
            limit: 20,
            after: null,
            search: null,
            hasAllergies: null,
          }),
      ],
    ],
  )('should answer for %s: %s', async (_subject, message, call) => {
    // Arrange
    const gone = new MedicalChartRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
