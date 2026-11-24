import type { ModelsStaffLevelType } from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { StaffRemoval } from '../api/staff-api'
import { aNewMember, aStaffMember } from '../components/examples'
import {
  activityNameOf,
  afterStaffRemoval,
  bookingsNameOf,
  bufferNameOf,
  commissionNameOf,
  concurrentBookingsNameOf,
  fullStaffNameOf,
  isOwnStaffRecord,
  LEVEL_CHOICES,
  levelNameOf,
  mayKeepStaffLedger,
  staffCalled,
  staffNameOf,
  yearsNameOf,
} from './staff-format'

describe('levelNameOf', () => {
  it.each<[ModelsStaffLevelType, LocalizedText]>([
    ['junior', { en: 'Junior', ja: 'ジュニア' }],
    ['stylist', { en: 'Stylist', ja: 'スタイリスト' }],
    ['senior', { en: 'Senior', ja: 'シニア' }],
    ['expert', { en: 'Expert', ja: 'エキスパート' }],
    ['director', { en: 'Director', ja: 'ディレクター' }],
  ])('should name the level %s', (level, name) => {
    // Act
    const named = levelNameOf(level)

    // Assert
    expect(named).toEqual(name)
  })

  it('should offer the levels in the order of the contract, by their names', () => {
    // Assert
    expect(LEVEL_CHOICES).toEqual([
      { value: 'junior', label: { en: 'Junior', ja: 'ジュニア' } },
      { value: 'stylist', label: { en: 'Stylist', ja: 'スタイリスト' } },
      { value: 'senior', label: { en: 'Senior', ja: 'シニア' } },
      { value: 'expert', label: { en: 'Expert', ja: 'エキスパート' } },
      { value: 'director', label: { en: 'Director', ja: 'ディレクター' } },
    ])
  })
})

describe('the names of a member', () => {
  it('should name a member family name first, with the kana there is, brackets as each language writes them', () => {
    // Act
    const names = [
      fullStaffNameOf(aStaffMember()),
      fullStaffNameOf(aStaffMember({ firstNameKana: null })),
      fullStaffNameOf(aNewMember()),
    ]

    // Assert
    expect(staffNameOf(aStaffMember())).toBe('田中 美咲')
    expect(names).toEqual([
      { en: '田中 美咲 (タナカ ミサキ)', ja: '田中 美咲（タナカ ミサキ）' },
      { en: '田中 美咲 (タナカ)', ja: '田中 美咲（タナカ）' },
      { en: '佐藤 健', ja: '佐藤 健' },
    ])
  })

  it('should call a member by the name the customers see, with the honorific in Japanese alone', () => {
    // Act
    const called = staffCalled(aStaffMember())

    // Assert
    expect(called).toEqual({ en: '田中 美咲', ja: '田中 美咲 さん' })
  })
})

describe('what the ledger keeps of a member, in words', () => {
  it('should say whether a member is active and takes bookings', () => {
    // Act
    const said = [
      activityNameOf(aStaffMember()),
      activityNameOf(aNewMember()),
      bookingsNameOf(aStaffMember()),
      bookingsNameOf(aNewMember()),
    ]

    // Assert
    expect(said).toEqual([
      { en: 'Active', ja: '有効' },
      { en: 'Inactive', ja: '無効' },
      { en: 'Accepted', ja: '受ける' },
      { en: 'Not accepted', ja: '受けない' },
    ])
  })

  it.each<[number, string]>([
    [10, '10%'],
    [12.5, '12.5%'],
    [0.01, '0.01%'],
    [7.125, '7.13%'],
    [0, '0%'],
  ])('should write the rate %s to two decimal places', (rate, name) => {
    // Act
    const written = commissionNameOf(rate)

    // Assert
    expect(written).toEqual({ en: name, ja: name })
  })

  it.each<[number, LocalizedText]>([
    [0, { en: 'None', ja: 'なし' }],
    [15, { en: '15 min', ja: '15 分' }],
  ])('should write the time %s kept around a booking', (minutes, name) => {
    // Act
    const written = bufferNameOf(minutes)

    // Assert
    expect(written).toEqual(name)
  })

  it('should count the bookings taken at a time and the years of experience, and no years that were not written', () => {
    // Act
    const said = [
      concurrentBookingsNameOf(1),
      concurrentBookingsNameOf(3),
      yearsNameOf(1),
      yearsNameOf(8),
    ]

    // Assert
    expect(said).toEqual([
      { en: 'Up to 1 booking', ja: '1 件まで' },
      { en: 'Up to 3 bookings', ja: '3 件まで' },
      { en: '1 year', ja: '1 年' },
      { en: '8 years', ja: '8 年' },
    ])
    expect(yearsNameOf(null)).toBeNull()
  })
})

describe('isOwnStaffRecord', () => {
  it.each<[string, string | null, string | undefined, boolean]>([
    ['the account linked to the member', 'user', 'user', true],
    ['another account', 'user', 'other', false],
    ['a member no account is linked to', null, 'user', false],
    ['nobody signed in', null, undefined, false],
  ])(
    'should tell whether the member is that of %s',
    (_case, userId, signedIn, own) => {
      // Act
      const found = isOwnStaffRecord({ userId }, signedIn)

      // Assert
      expect(found).toBe(own)
    },
  )
})

describe('mayKeepStaffLedger', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['admin', true],
    ['manager', false],
    ['staff', false],
    ['customer', false],
  ])('should tell whether the role %s keeps the ledger', (role, keeps) => {
    // Act
    const found = mayKeepStaffLedger(role)

    // Assert
    expect(found).toBe(keeps)
  })
})

describe('afterStaffRemoval', () => {
  it.each<[string, StaffRemoval, ReturnType<typeof afterStaffRemoval>]>([
    [
      'a removal',
      { type: 'removed' },
      {
        type: 'done',
        message: {
          en: 'Removed 田中 美咲 from the staff ledger.',
          ja: '田中 美咲 さんを、スタッフ台帳から削除しました。',
        },
      },
    ],
    [
      'bookings that name the member',
      { type: 'busy' },
      {
        type: 'refused',
        message: {
          en: '田中 美咲 is assigned to bookings that are not finished (Draft, Awaiting confirmation, Confirmed, In progress), so they cannot be removed. Complete or cancel those bookings, or give them to another staff member by changing their date and time, then remove the staff member.',
          ja: '田中 美咲 さんは、終わっていない予約（下書き、確定待ち、確定、施術中）を担当しているため、削除できません。予約を完了するか、キャンセルするか、日時の変更で担当をほかのスタッフに替えてから、削除してください。',
        },
      },
    ],
    ['a member removed meanwhile', { type: 'notFound' }, { type: 'gone' }],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      {
        type: 'refused',
        message: {
          en: 'This account cannot remove staff members of this salon. Only the owner of the salon and administrators can keep the staff ledger.',
          ja: 'このアカウントでは、このサロンのスタッフを削除できません。スタッフ台帳を扱えるのは、サロンのオーナーと管理者です。',
        },
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message: {
          en: 'There are too many requests. Wait a while and try again.',
          ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        },
      },
    ],
    [
      'a failure',
      { type: 'failed' },
      {
        type: 'again',
        message: {
          en: 'Could not remove the staff member. Check your connection and try again.',
          ja: 'スタッフを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      },
    ],
  ])('should say what came of %s', (_case, outcome, says) => {
    // Act
    const said = afterStaffRemoval(outcome, '田中 美咲')

    // Assert
    expect(said).toEqual(says)
  })
})
