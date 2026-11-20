import type {
  ModelsMedicalChartResponse,
  ModelsPreviousTreatment,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { aCustomer, customers } from '../bookings/components/examples'
import {
  afterMerge,
  type MergeAttempt,
  type MergeObstacle,
  type MergePair,
  type MergeRecords,
  type MergeSays,
  type MergeWay,
  mergedLedgerOf,
  mergeObstaclesOf,
  mergeWayIn,
  mergeWayNameOf,
  obstacleTextOf,
} from './customer-merge'

const [hanako = aCustomer(), ichiro = aCustomer()] = customers

/** Hanako kept, and Ichiro merged into her: they differ in their names, kana and address of mail */
const PAIR: MergePair = { primary: hanako, secondary: ichiro }

const aChart = (
  changes: Partial<ModelsMedicalChartResponse> = {},
): ModelsMedicalChartResponse => ({
  id: '2b7c9d1e-3f4a-4b5c-8d6e-7f8091a2b3c4',
  customerId: hanako.id,
  previousTreatments: [],
  medicalConditions: null,
  preferredProducts: [],
  avoidProducts: [],
  notes: null,
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
  ...changes,
})

const NOTHING: MergeRecords = {
  erasureAsked: { primary: false, secondary: false },
  charts: { primary: null, secondary: null },
}

const products = (count: number, start = 0): string[] =>
  Array.from({ length: count }, (_, index) => `製品 ${start + index}`)

/** So many cuts, a day apart from the first of January 2026 on, from the day given */
const treatments = (count: number, start = 0): ModelsPreviousTreatment[] =>
  Array.from({ length: count }, (_, index) => ({
    treatment: 'cut',
    date: new Date(Date.UTC(2026, 0, 1 + start + index))
      .toISOString()
      .slice(0, 10),
    salonName: null,
    notes: null,
  }))

describe('mergeWayNameOf', () => {
  it.each<[MergeWay, string]>([
    ['keep_primary', '残すお客様の値'],
    ['keep_secondary', 'まとめるお客様の値'],
    ['keep_newest', 'あとから台帳を直したほうの値'],
  ])('should offer %s as 「%s」', (way, name) => {
    // Act
    const offered = mergeWayNameOf(way)

    // Assert
    expect(offered).toBe(name)
  })
})

describe('mergeWayIn', () => {
  it.each<[string | null, MergeWay | undefined]>([
    ['keep_primary', 'keep_primary'],
    ['keep_secondary', 'keep_secondary'],
    ['keep_newest', 'keep_newest'],
    ['keep_oldest', undefined],
    [null, undefined],
  ])('should read %s as %s', (value, way) => {
    // Act
    const read = mergeWayIn(value)

    // Assert
    expect(read).toBe(way)
  })
})

describe('mergedLedgerOf', () => {
  it('should keep what both have alike, whatever the way', () => {
    // Act
    const merged = mergedLedgerOf(PAIR, 'keep_secondary')

    // Assert
    expect(merged).toMatchObject({
      phoneNumber: hanako.phoneNumber,
      membershipTier: 'regular',
      allowEmail: true,
      customerStatus: 'active',
    })
  })

  it.each<[MergeWay, string]>([
    ['keep_primary', 'hanako@example.com'],
    ['keep_secondary', 'ichiro@example.com'],
  ])(
    'should take what they have differently from the one %s names',
    (way, email) => {
      // Act
      const merged = mergedLedgerOf(PAIR, way)

      // Assert
      expect(merged.email).toBe(email)
    },
  )

  it.each<[string, string, string]>([
    [
      'the merged one was written later',
      '2026-03-01T00:00:00.001Z',
      'ichiro@example.com',
    ],
    [
      'the kept one was written later',
      '2026-01-09T23:59:59.999Z',
      'hanako@example.com',
    ],
    [
      'both were written at the same moment',
      hanako.updatedAt,
      'hanako@example.com',
    ],
  ])('should take the newest when %s', (_, updatedAt, email) => {
    // Arrange
    const pair: MergePair = {
      primary: hanako,
      secondary: { ...ichiro, updatedAt },
    }

    // Act
    const merged = mergedLedgerOf(pair, 'keep_newest')

    // Assert
    expect(merged.email).toBe(email)
  })

  it('should take what only one of them has, whatever the way', () => {
    // Arrange
    const pair: MergePair = {
      primary: { ...hanako, occupation: '会社員', tags: [] },
      secondary: {
        ...ichiro,
        alternativePhone: '03-1234-5678',
        occupation: null,
        tags: ['vip'],
      },
    }

    // Act
    const merged = mergedLedgerOf(pair, 'keep_primary')
    const otherway = mergedLedgerOf(pair, 'keep_secondary')

    // Assert
    for (const values of [merged, otherway]) {
      expect(values).toMatchObject({
        occupation: '会社員',
        alternativePhone: '03-1234-5678',
        tags: ['vip'],
      })
    }
  })

  it('should take the tags of the way when both have some', () => {
    // Arrange
    const pair: MergePair = {
      primary: { ...hanako, tags: ['vip'] },
      secondary: { ...ichiro, tags: ['regular'] },
    }

    // Act
    const merged = mergedLedgerOf(pair, 'keep_secondary')

    // Assert
    expect(merged.tags).toEqual(['regular'])
  })

  it('should compare the preferences as one value', () => {
    // Arrange
    const pair: MergePair = {
      primary: {
        ...hanako,
        preferences: { preferredServices: ['cut'], notes: null },
      },
      secondary: {
        ...ichiro,
        preferences: { preferredServices: ['cut'], notes: '静かに' },
      },
    }

    // Act
    const merged = mergedLedgerOf(pair, 'keep_secondary')

    // Assert
    expect(merged.preferences).toEqual({
      preferredServices: ['cut'],
      notes: '静かに',
    })
  })

  it('should take no referrer who is one of the two, and the referrer of the other', () => {
    // Arrange
    const referrer = 'd2a0e5b8-7f9d-4b1e-a3c5-1e8f4a7b9cd6'
    const pair: MergePair = {
      primary: { ...hanako, referredBy: ichiro.id },
      secondary: { ...ichiro, referredBy: referrer },
    }

    // Act
    const merged = mergedLedgerOf(pair, 'keep_primary')

    // Assert
    expect(merged.referredBy).toBe(referrer)
  })

  it('should take no referrer when each referred the other', () => {
    // Arrange
    const pair: MergePair = {
      primary: { ...hanako, referredBy: ichiro.id },
      secondary: { ...ichiro, referredBy: hanako.id },
    }

    // Act
    const merged = mergedLedgerOf(pair, 'keep_secondary')

    // Assert
    expect(merged.referredBy).toBeNull()
  })
})

describe('mergeObstaclesOf', () => {
  it('should find nothing in the way of two customers without accounts, requests or charts', () => {
    // Act
    const obstacles = mergeObstaclesOf(PAIR, NOTHING)

    // Assert
    expect(obstacles).toEqual([])
  })

  it('should let one account come along', () => {
    // Arrange
    const pair: MergePair = {
      primary: hanako,
      secondary: { ...ichiro, userId: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d' },
    }

    // Act
    const obstacles = mergeObstaclesOf(pair, NOTHING)

    // Assert
    expect(obstacles).toEqual([])
  })

  it('should say everything in the way, in the order the API checks it', () => {
    // Arrange
    const pair: MergePair = {
      primary: {
        ...hanako,
        userId: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d',
        loyaltyPoints: 2_000_000_000,
      },
      secondary: {
        ...ichiro,
        userId: '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e',
        loyaltyPoints: 147_483_648,
      },
    }
    const records: MergeRecords = {
      erasureAsked: { primary: true, secondary: true },
      charts: {
        primary: aChart({
          previousTreatments: treatments(26),
          preferredProducts: products(30),
        }),
        secondary: aChart({
          customerId: ichiro.id,
          previousTreatments: treatments(25, 26),
          preferredProducts: products(21, 30),
          avoidProducts: products(51),
        }),
      },
    }

    // Act
    const obstacles = mergeObstaclesOf(pair, records)

    // Assert
    expect(obstacles).toEqual<MergeObstacle[]>([
      { type: 'accounts' },
      { type: 'erasureAsked', who: '山田 花子 様（hanako@example.com）' },
      { type: 'erasureAsked', who: '鈴木 一郎 様（ichiro@example.com）' },
      { type: 'points', total: 2_147_483_648 },
      { type: 'chart', list: 'previousTreatments' },
      { type: 'chart', list: 'preferredProducts' },
      { type: 'chart', list: 'avoidProducts' },
    ])
  })

  it('should let the points of both come to the largest balance', () => {
    // Arrange
    const pair: MergePair = {
      primary: { ...hanako, loyaltyPoints: 2_000_000_000 },
      secondary: { ...ichiro, loyaltyPoints: 147_483_647 },
    }

    // Act
    const obstacles = mergeObstaclesOf(pair, NOTHING)

    // Assert
    expect(obstacles).toEqual([])
  })

  it('should count once what both charts list, and let 50 come together', () => {
    // Arrange
    const treatment: ModelsPreviousTreatment = {
      treatment: 'cut',
      date: '2026-01-10',
      salonName: null,
      notes: null,
    }
    const records: MergeRecords = {
      ...NOTHING,
      charts: {
        primary: aChart({
          previousTreatments: [treatment],
          preferredProducts: products(40),
        }),
        secondary: aChart({
          customerId: ichiro.id,
          previousTreatments: [treatment],
          preferredProducts: products(20, 30),
        }),
      },
    }

    // Act
    const obstacles = mergeObstaclesOf(PAIR, records)

    // Assert
    expect(obstacles).toEqual([])
  })

  it('should let a chart that only one of them has move as it is', () => {
    // Arrange
    const records: MergeRecords = {
      ...NOTHING,
      charts: {
        primary: null,
        secondary: aChart({ avoidProducts: products(50) }),
      },
    }

    // Act
    const obstacles = mergeObstaclesOf(PAIR, records)

    // Assert
    expect(obstacles).toEqual([])
  })
})

describe('obstacleTextOf', () => {
  it.each<[MergeObstacle, string]>([
    [
      { type: 'accounts' },
      '2 人とも、ご自分のアカウントでサインインしているお客様です。アカウントは 1 つにまとめられないため、まとめられません。',
    ],
    [
      { type: 'erasureAsked', who: '山田 花子 様（hanako@example.com）' },
      '山田 花子 様（hanako@example.com）から、データの削除の依頼を受け付けています。依頼を取り消してから、まとめてください。',
    ],
    [
      { type: 'points', total: 2_147_483_648 },
      '2 人のポイントを合わせると 2,147,483,648 ポイントになり、1 人が持てる 2,147,483,647 ポイントを超えます。',
    ],
    [
      { type: 'chart', list: 'previousTreatments' },
      '2 人のカルテを合わせると、施術歴が 50 件を超えます。どちらかのカルテを短くしてから、まとめてください。',
    ],
    [
      { type: 'chart', list: 'avoidProducts' },
      '2 人のカルテを合わせると、避けたい製品が 50 件を超えます。どちらかのカルテを短くしてから、まとめてください。',
    ],
  ])('should say %j as a sentence', (obstacle, text) => {
    // Act
    const said = obstacleTextOf(obstacle)

    // Assert
    expect(said).toBe(text)
  })
})

describe('afterMerge', () => {
  const merged = { ...hanako, visitCount: 3 }

  it.each<[string, MergeAttempt, MergeSays]>([
    [
      'the merge',
      { type: 'merged', customer: merged },
      {
        type: 'done',
        customer: merged,
        message: '2 人のお客様を、山田 花子 様にまとめました。',
      },
    ],
    [
      'the merged one gone',
      { type: 'gone', sides: ['secondary'] },
      {
        type: 'refused',
        message:
          '鈴木 一郎 様（ichiro@example.com）は、もう台帳にいません。ほかの画面で、台帳から削除されたか、ほかのお客様にまとめられました。',
      },
    ],
    [
      'both gone',
      { type: 'gone', sides: ['primary', 'secondary'] },
      {
        type: 'refused',
        message:
          '山田 花子 様（hanako@example.com）と鈴木 一郎 様（ichiro@example.com）は、もう台帳にいません。ほかの画面で、台帳から削除されたか、ほかのお客様にまとめられました。',
      },
    ],
    [
      'a refusal the API tells in a sentence',
      { type: 'refused' },
      {
        type: 'refused',
        message:
          'その間に 2 人の記録が変わったため、まとめられませんでした。2 人の記録を読み直しました。',
      },
    ],
    [
      'an account that may not merge',
      { type: 'forbidden' },
      {
        type: 'refused',
        message:
          'このアカウントでは、お客様をまとめられません。台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'again',
        message:
          'お客様をまとめられませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should follow %s', (_, outcome, says) => {
    // Act
    const follows = afterMerge(outcome, PAIR)

    // Assert
    expect(follows).toEqual(says)
  })
})
