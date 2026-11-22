import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  CUSTOMER_ALLERGY_ID,
  dbCustomerAllergy,
  OTHER_CUSTOMER_ALLERGY_ID,
} from '../../../__tests__/fixtures/customer-allergy-fixtures'
import {
  apiCustomer,
  customerDependencies,
  dbCustomer,
  OTHER_CUSTOMER_ID,
  REFERRER_ID,
} from '../../../__tests__/fixtures/customer-fixtures'
import { brokenRules } from '../../../__tests__/fixtures/fixtures'
import {
  dbMedicalChart,
  OTHER_MEDICAL_CHART_ID,
} from '../../../__tests__/fixtures/medical-chart-fixtures'
import { dbPointTransaction } from '../../../__tests__/fixtures/point-fixtures'
import type { Actor } from '../../../models/auth'
import type { ApiCustomerMergeRequest } from '../../../models/customer'
import type { DbCustomerAllergy } from '../../../models/customer-allergy'
import type { DbMedicalChart } from '../../../models/medical-chart'
import type { DbPointTransaction } from '../../../models/point'
import type {
  CustomerMerge,
  CustomerRestoration,
  MergedCustomerField,
} from '../../../repositories/customer.repository'
import { customerMergeRequestSchema } from '../../../schemas/customer-merge.schema'
import { MOST_LISTED } from '../../../schemas/medical-chart.schema'
import { type DomainError, DomainErrors } from '../../../shared'
import { planTransfer } from '../../point'
import {
  allergyMergeOf,
  type ChartList,
  chartMergeOf,
  MergeCustomersUseCase,
  type MergeSide,
  mergedLedgerOf,
  type PreferencesMerge,
  preferencesMergeOf,
  RestoreCustomerUseCase,
  sideOf,
} from '..'

/** A customer the merged two may refer to. */
const THIRD_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1c03'

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

const request = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  primaryCustomerId: CUSTOMER_ID,
  secondaryCustomerId: OTHER_CUSTOMER_ID,
  conflictResolution: 'keep_primary',
  ...overrides,
})

/** The customer kept, and the one merged into it. */
const primary = dbCustomer()
const secondary = dbCustomer({
  id: OTHER_CUSTOMER_ID,
  email: 'hanako.other@example.com',
  referralCode: 'OTHER2026',
})

describe('customerMergeRequestSchema', () => {
  it('takes two customers and a resolution, the IDs in lower case', () => {
    const parsed = customerMergeRequestSchema.safeParse(
      request({ secondaryCustomerId: OTHER_CUSTOMER_ID.toUpperCase() }),
    )

    expect(parsed.success && parsed.data).toEqual(request())
  })

  const refused: [string, Record<string, unknown>, string][] = [
    [
      'the same customer twice',
      { secondaryCustomerId: CUSTOMER_ID },
      'secondaryCustomerId:custom',
    ],
    [
      'the same customer twice, once in upper case',
      { secondaryCustomerId: CUSTOMER_ID.toUpperCase() },
      'secondaryCustomerId:custom',
    ],
    [
      'a primary that is no ID',
      { primaryCustomerId: 'first' },
      'primaryCustomerId:invalid_format',
    ],
    [
      'a secondary that is no ID',
      { secondaryCustomerId: 42 },
      'secondaryCustomerId:invalid_type',
    ],
    [
      'an unknown resolution',
      { conflictResolution: 'keep_both' },
      'conflictResolution:invalid_value',
    ],
    [
      'no resolution',
      { conflictResolution: undefined },
      'conflictResolution:invalid_value',
    ],
    ['a property of no request', { mergedBy: USER_ID }, ':unrecognized_keys'],
  ]

  it.each(refused)('refuses %s', (_, overrides, rule) => {
    const parsed = customerMergeRequestSchema.safeParse(request(overrides))

    expect(parsed.success).toBe(false)
    expect(
      parsed.error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`),
    ).toEqual([rule])
  })
})

describe('sideOf', () => {
  const cases: [
    ApiCustomerMergeRequest['conflictResolution'],
    MergeSide,
    MergeSide,
  ][] = [
    ['keep_primary', 'secondary', 'primary'],
    ['keep_secondary', 'primary', 'secondary'],
    ['keep_newest', 'primary', 'primary'],
    ['keep_newest', 'secondary', 'secondary'],
  ]

  it.each(cases)(
    'takes %s with the %s newer: the %s',
    (resolution, newer, side) => {
      expect(sideOf(resolution, newer)).toBe(side)
    },
  )
})

describe('mergedLedgerOf', () => {
  it('keeps what both have', () => {
    const ledger = mergedLedgerOf(
      primary,
      dbCustomer({ id: OTHER_CUSTOMER_ID }),
      'secondary',
    )

    expect(ledger.firstName).toBe(primary.firstName)
    expect(ledger.tags).toEqual(primary.tags)
    expect(ledger.preferences).toEqual(primary.preferences)
  })

  it.each<MergeSide>(['primary', 'secondary'])(
    'takes the value of the one that has one, whichever side the %s is',
    (side) => {
      const withGaps = dbCustomer({
        alternativePhone: null,
        occupation: '会社員',
        tags: [],
      })
      const filled = dbCustomer({
        id: OTHER_CUSTOMER_ID,
        alternativePhone: '03-1234-5678',
        occupation: null,
        tags: ['常連'],
      })

      expect(mergedLedgerOf(withGaps, filled, side)).toMatchObject({
        alternativePhone: '03-1234-5678',
        occupation: '会社員',
        tags: ['常連'],
      })
      expect(mergedLedgerOf(filled, withGaps, side)).toMatchObject({
        alternativePhone: '03-1234-5678',
        occupation: '会社員',
        tags: ['常連'],
      })
    },
  )

  const differing: [MergeSide, string, string, string, boolean][] = [
    ['primary', 'hanako.yamada@example.com', 'HANAKO2026', 'gold', false],
    ['secondary', 'hanako.other@example.com', 'OTHER2026', 'silver', true],
  ]

  it.each(differing)(
    'takes the values of the %s where both differ',
    (side, email, referralCode, membershipTier, allowSms) => {
      const ledger = mergedLedgerOf(
        primary,
        dbCustomer({ ...secondary, membershipTier: 'silver', allowSms: true }),
        side,
      )

      expect(ledger).toMatchObject({
        email,
        referralCode,
        membershipTier,
        allowSms,
      })
    },
  )

  it('compares structured values by what they hold', () => {
    const ledger = mergedLedgerOf(
      dbCustomer({ preferences: { preferredServices: ['cut'], notes: null } }),
      dbCustomer({
        id: OTHER_CUSTOMER_ID,
        preferences: { preferredServices: ['color'], notes: null },
      }),
      'secondary',
    )

    expect(ledger.preferences).toEqual({
      preferredServices: ['color'],
      notes: null,
    })
  })

  const referrers: [
    string,
    string | null,
    string | null,
    MergeSide,
    string | null,
  ][] = [
    [
      'the primary refers to the secondary',
      OTHER_CUSTOMER_ID,
      REFERRER_ID,
      'primary',
      REFERRER_ID,
    ],
    [
      'the secondary refers to the primary',
      REFERRER_ID,
      CUSTOMER_ID,
      'secondary',
      REFERRER_ID,
    ],
    [
      'each refers to the other',
      OTHER_CUSTOMER_ID,
      CUSTOMER_ID,
      'secondary',
      null,
    ],
    [
      'each refers to another, the primary taken',
      REFERRER_ID,
      THIRD_ID,
      'primary',
      REFERRER_ID,
    ],
    [
      'each refers to another, the secondary taken',
      REFERRER_ID,
      THIRD_ID,
      'secondary',
      THIRD_ID,
    ],
  ]

  it.each(referrers)(
    'takes a referrer that is one of the two for none: %s',
    (_, primaryReferrer, secondaryReferrer, side, referredBy) => {
      const ledger = mergedLedgerOf(
        dbCustomer({ referredBy: primaryReferrer }),
        dbCustomer({ id: OTHER_CUSTOMER_ID, referredBy: secondaryReferrer }),
        side,
      )

      expect(ledger.referredBy).toBe(referredBy)
    },
  )

  it('writes the thirty values of the ledger and nothing the ledger does not write', () => {
    const ledger = mergedLedgerOf(primary, secondary, 'primary')

    expect(Object.keys(ledger)).toHaveLength(30)
    expect(ledger).not.toHaveProperty('loyaltyPoints')
    expect(ledger).not.toHaveProperty('userId')
    expect(ledger).not.toHaveProperty('visitCount')
  })
})

describe('preferencesMergeOf', () => {
  const cases: [
    string | undefined,
    string | undefined,
    MergeSide,
    PreferencesMerge<string>,
  ][] = [
    [undefined, undefined, 'secondary', { type: 'keep' }],
    ['primary row', undefined, 'secondary', { type: 'keep' }],
    [undefined, 'secondary row', 'primary', { type: 'move' }],
    ['primary row', 'secondary row', 'primary', { type: 'keep' }],
    [
      'primary row',
      'secondary row',
      'secondary',
      { type: 'copy', row: 'secondary row' },
    ],
  ]

  it.each(cases)(
    'with %s and %s, the %s side: %j',
    (primaryRow, secondaryRow, side, merge) => {
      expect(preferencesMergeOf(primaryRow, secondaryRow, side)).toEqual(merge)
    },
  )
})

describe('chartMergeOf', () => {
  const secondaryChart = (overrides: Partial<DbMedicalChart> = {}) =>
    dbMedicalChart({
      id: OTHER_MEDICAL_CHART_ID,
      customerId: OTHER_CUSTOMER_ID,
      ...overrides,
    })

  it('keeps the primary chart, or none, when the secondary has none', () => {
    expect(chartMergeOf(dbMedicalChart(), null)).toEqual(
      Result.success({ type: 'keep' }),
    )
    expect(chartMergeOf(null, null)).toEqual(Result.success({ type: 'keep' }))
  })

  it('moves the chart of the secondary when the primary has none', () => {
    expect(chartMergeOf(null, secondaryChart())).toEqual(
      Result.success({ type: 'move' }),
    )
  })

  it('drops nothing of either: the lists together, the primary first, and texts that differ joined', () => {
    const merged = chartMergeOf(
      dbMedicalChart(),
      secondaryChart({
        previousTreatments: [
          {
            treatment: 'perm',
            date: '2025-11-02',
            salonName: null,
            notes: null,
          },
          {
            treatment: 'treatment',
            date: '2024-05-01',
            salonName: null,
            notes: null,
          },
        ],
        medicalConditions: '金属アレルギーの疑い',
        preferredProducts: ['Aveda', 'Kerastase'],
        avoidProducts: [],
        notes: null,
      }),
    )

    expect(merged).toEqual(
      Result.success({
        type: 'combine',
        values: {
          previousTreatments: [
            {
              treatment: 'color',
              date: '2026-03-14',
              salonName: 'Hair Studio Ginza',
              notes: 'ブリーチ 1 回',
            },
            {
              treatment: 'perm',
              date: '2025-11-02',
              salonName: null,
              notes: null,
            },
            {
              treatment: 'treatment',
              date: '2024-05-01',
              salonName: null,
              notes: null,
            },
          ],
          medicalConditions: '頭皮が乾燥しやすい\n\n金属アレルギーの疑い',
          preferredProducts: ['Aveda', 'オーガニックシャンプー', 'Kerastase'],
          avoidProducts: ['強い香料の整髪料'],
          notes: 'ぬるめのお湯を希望',
        },
      }),
    )
  })

  it('takes the text of the one that has it, and one text where both are the same', () => {
    const merged = chartMergeOf(
      dbMedicalChart({ medicalConditions: null }),
      secondaryChart({ medicalConditions: '敏感肌' }),
    )

    expect(merged.type === 'success' && merged.data).toMatchObject({
      values: { medicalConditions: '敏感肌', notes: 'ぬるめのお湯を希望' },
    })
  })

  const treatments = (salonName: string, count: number) =>
    Array.from({ length: count }, (_, day) => ({
      treatment: 'cut',
      date: `2020-01-${String(day + 1).padStart(2, '0')}`,
      salonName,
      notes: null,
    }))
  const products = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => `${prefix}${index}`)
  const lists: [
    ChartList,
    (prefix: string, count: number) => Partial<DbMedicalChart>,
  ][] = [
    [
      'previousTreatments',
      (prefix, count) => ({ previousTreatments: treatments(prefix, count) }),
    ],
    [
      'preferredProducts',
      (prefix, count) => ({ preferredProducts: products(prefix, count) }),
    ],
    [
      'avoidProducts',
      (prefix, count) => ({ avoidProducts: products(prefix, count) }),
    ],
  ]

  it.each(lists)(
    'refuses two charts that together list more %s than a chart can',
    (list, listing) => {
      const merged = chartMergeOf(
        dbMedicalChart(listing('a', MOST_LISTED / 2 + 1)),
        secondaryChart(listing('b', MOST_LISTED / 2)),
      )

      expect(merged).toEqual(Result.success({ type: 'tooLong', list }))
    },
  )

  it.each(lists)(
    'takes two charts that together list as many %s as a chart can',
    (_, listing) => {
      const merged = chartMergeOf(
        dbMedicalChart(listing('a', MOST_LISTED / 2)),
        secondaryChart(listing('b', MOST_LISTED / 2)),
      )

      expect(merged.type === 'success' && merged.data.type).toBe('combine')
    },
  )

  it('fails on a stored chart that does not match the model', () => {
    const merged = chartMergeOf(
      dbMedicalChart(),
      secondaryChart({ previousTreatments: [{ treatment: 'unknown' }] }),
    )

    expect(merged).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('allergyMergeOf', () => {
  const ofSecondary = (overrides: Partial<DbCustomerAllergy>) =>
    dbCustomerAllergy({
      id: OTHER_CUSTOMER_ALLERGY_ID,
      customerId: OTHER_CUSTOMER_ID,
      ...overrides,
    })

  it('moves an allergen the primary has none of', () => {
    expect(
      allergyMergeOf(
        [dbCustomerAllergy()],
        [ofSecondary({ allergenName: 'ラテックス' })],
      ),
    ).toEqual({ moved: [OTHER_CUSTOMER_ALLERGY_ID], replaced: [] })
  })

  it('keeps the severer record of an allergen both have', () => {
    const severer = ofSecondary({
      allergyType: 'metal',
      severityType: 'life_threatening',
      symptoms: '呼吸が苦しくなる',
      notes: null,
      confirmedDate: '2026-01-05',
    })

    expect(allergyMergeOf([dbCustomerAllergy()], [severer])).toEqual({
      moved: [],
      replaced: [
        {
          id: CUSTOMER_ALLERGY_ID,
          values: {
            allergyType: 'metal',
            severityType: 'life_threatening',
            symptoms: '呼吸が苦しくなる',
            notes: null,
            confirmedDate: '2026-01-05',
          },
        },
      ],
    })
  })

  const notSeverer: [string, DbCustomerAllergy['severityType']][] = [
    ['as severe', 'severe'],
    ['milder', 'mild'],
  ]

  it.each(notSeverer)(
    'keeps the record of the primary when the secondary is %s',
    (_, severityType) => {
      expect(
        allergyMergeOf(
          [dbCustomerAllergy()],
          [ofSecondary({ severityType, symptoms: null })],
        ),
      ).toEqual({ moved: [], replaced: [] })
    },
  )

  it('tells allergens apart by their exact name', () => {
    expect(
      allergyMergeOf(
        [dbCustomerAllergy({ allergenName: 'latex' })],
        [ofSecondary({ allergenName: 'Latex' })],
      ).moved,
    ).toEqual([OTHER_CUSTOMER_ALLERGY_ID])
  })
})

describe('planTransfer', () => {
  /** Point transactions of the secondary: `[type, points, expiryDate]` each. */
  const ledger = (
    ...rows: [DbPointTransaction['transactionType'], number, string | null][]
  ): DbPointTransaction[] => {
    let balance = 0
    return rows.map(([transactionType, points, expiryDate], index) => {
      balance += points
      return dbPointTransaction({
        id: `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7${String(index).padStart(3, '0')}`,
        customerId: OTHER_CUSTOMER_ID,
        transactionType,
        points,
        balance,
        expiryDate,
        referenceType: null,
        referenceId: null,
        createdAt: `2026-11-${String(index + 1).padStart(2, '0')} 10:00:00+00`,
      })
    })
  }
  const parties = (fromBalance: number, toBalance = 100) => ({
    from: { customerId: OTHER_CUSTOMER_ID, balance: fromBalance },
    to: { customerId: CUSTOMER_ID, balance: toBalance },
  })

  it('moves nothing from a customer without points', () => {
    const nothing = { type: 'planned', from: null, to: [] }

    expect(planTransfer(parties(0), [])).toEqual(nothing)
    expect(
      planTransfer(
        parties(0),
        ledger(['earned', 50, null], ['used', -50, null]),
      ),
    ).toEqual(nothing)
  })

  it('moves what is left of each increase with its expiry date, and takes the balance of the secondary to 0', () => {
    const plan = planTransfer(
      parties(130),
      ledger(
        ['earned', 100, '2027-03-31'],
        ['adjusted', 50, null],
        ['used', -40, null],
        ['earned', 20, '2027-01-31'],
      ),
    )

    const toPrimary = {
      customerId: CUSTOMER_ID,
      transactionType: 'transferred',
      description: null,
      referenceType: 'customer',
      referenceId: OTHER_CUSTOMER_ID,
    }
    expect(plan).toEqual({
      type: 'planned',
      from: {
        customerId: OTHER_CUSTOMER_ID,
        transactionType: 'transferred',
        points: -130,
        balance: 0,
        description: null,
        referenceType: 'customer',
        referenceId: CUSTOMER_ID,
        expiryDate: null,
      },
      to: [
        { ...toPrimary, points: 60, balance: 160, expiryDate: '2027-03-31' },
        { ...toPrimary, points: 50, balance: 210, expiryDate: null },
        { ...toPrimary, points: 20, balance: 230, expiryDate: '2027-01-31' },
      ],
    })
  })

  it('moves a lapsed increase that has not expired yet, with its date', () => {
    const plan = planTransfer(parties(30), ledger(['earned', 30, '2026-01-31']))

    expect(plan.type === 'planned' && plan.to).toEqual([
      expect.objectContaining({ points: 30, expiryDate: '2026-01-31' }),
    ])
  })

  it('refuses a balance of the primary beyond the largest one, and takes the largest one', () => {
    expect(
      planTransfer(parties(8, 2_147_483_640), ledger(['earned', 8, null])),
    ).toEqual({ type: 'beyondLimit' })
    expect(
      planTransfer(parties(7, 2_147_483_640), ledger(['earned', 7, null])).type,
    ).toBe('planned')
  })
})

describe('MergeCustomersUseCase', () => {
  const merging = (outcome: CustomerMerge) =>
    customerDependencies({
      merge: vi.fn(async () => Result.success(outcome)),
    })
  const mergeOf = (dependencies: ReturnType<typeof customerDependencies>) =>
    vi.mocked(dependencies.customerRepository.merge)

  const mayMerge: [string, Actor][] = [
    ['an administrator', actors.admin],
    ['an owner', actors.ofSalon('owner')],
    ['a manager', actors.ofSalon('manager')],
  ]
  const mayNot: [string, Actor][] = [
    ['a staff member', actors.ofSalon('staff')],
    ['a customer', actors.customer],
    ['a customer without a profile', actors.customerWithoutProfile],
    ['a user of no scope', actors.withoutScope],
  ]

  it.each(mayMerge)(
    'lets %s merge, and answers with the primary',
    async (_, actor) => {
      const dependencies = customerDependencies()

      const result = await new MergeCustomersUseCase(dependencies).execute(
        actor,
        request({ secondaryCustomerId: OTHER_CUSTOMER_ID.toUpperCase() }),
      )

      expect(result).toEqual(Result.success(apiCustomer()))
      expect(mergeOf(dependencies)).toHaveBeenCalledWith(request(), USER_ID)
    },
  )

  it.each(mayNot)('refuses %s before the request is read', async (_, actor) => {
    const dependencies = customerDependencies()

    const result = await new MergeCustomersUseCase(dependencies).execute(
      actor,
      { what: 'ever' },
    )

    expect(result).toEqual(Result.error(DomainErrors.forbidden()))
    expect(mergeOf(dependencies)).not.toHaveBeenCalled()
  })

  it('refuses a request that names one customer twice, without merging', async () => {
    const dependencies = customerDependencies()

    const result = await new MergeCustomersUseCase(dependencies).execute(
      actors.admin,
      request({ secondaryCustomerId: CUSTOMER_ID }),
    )

    expect(rulesOf(result)).toEqual(['secondaryCustomerId:custom'])
    expect(mergeOf(dependencies)).not.toHaveBeenCalled()
  })

  const missing: [MergedCustomerField[], string[]][] = [
    [['primaryCustomerId'], ['primaryCustomerId:not_found']],
    [['secondaryCustomerId'], ['secondaryCustomerId:not_found']],
    [
      ['primaryCustomerId', 'secondaryCustomerId'],
      ['primaryCustomerId:not_found', 'secondaryCustomerId:not_found'],
    ],
  ]

  it.each(missing)(
    'tells a customer that is not there at %j',
    async (fields, rules) => {
      const result = await new MergeCustomersUseCase(
        merging({ type: 'customersNotFound', missing: fields }),
      ).execute(actors.admin, request())

      expect(rulesOf(result)).toEqual(rules)
    },
  )

  const conflicts: [CustomerMerge, string][] = [
    [{ type: 'accountsDiffer' }, 'accounts'],
    [{ type: 'pointsBeyondLimit' }, 'points'],
    [{ type: 'chartTooLong', list: 'avoidProducts' }, 'avoidProducts'],
    [
      { type: 'deletionRequested', customers: [OTHER_CUSTOMER_ID] },
      `Customer ${OTHER_CUSTOMER_ID} asked for their data to be erased`,
    ],
    [
      {
        type: 'deletionRequested',
        customers: [CUSTOMER_ID, OTHER_CUSTOMER_ID],
      },
      `Customer ${CUSTOMER_ID} and customer ${OTHER_CUSTOMER_ID} asked`,
    ],
  ]

  it.each(conflicts)('refuses with a conflict: %j', async (outcome, said) => {
    const result = await new MergeCustomersUseCase(merging(outcome)).execute(
      actors.admin,
      request(),
    )

    expect(result).toEqual(
      Result.error(DomainErrors.conflict(expect.stringContaining(said))),
    )
  })

  it('passes on a failure of the database', async () => {
    const down = Result.error(DomainErrors.database('Connection lost', null))
    const dependencies = customerDependencies({
      merge: vi.fn(async () => down),
    })

    const result = await new MergeCustomersUseCase(dependencies).execute(
      actors.admin,
      request(),
    )

    expect(result).toEqual(down)
  })
})

describe('RestoreCustomerUseCase of a customer that cannot come back', () => {
  const gone: [CustomerRestoration, string][] = [
    [{ type: 'mergedAway' }, 'merged'],
    [{ type: 'erased' }, 'erased at their request'],
  ]

  it.each(gone)('refuses %j with a conflict', async (outcome, said) => {
    const dependencies = customerDependencies({
      restore: vi.fn(async () => Result.success(outcome)),
    })

    const result = await new RestoreCustomerUseCase(dependencies).execute(
      actors.admin,
      CUSTOMER_ID,
    )

    expect(result).toEqual(
      Result.error(DomainErrors.conflict(expect.stringContaining(said))),
    )
  })
})
