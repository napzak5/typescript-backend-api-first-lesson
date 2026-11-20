import type { ModelsStaffLevelType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { aNewMember, aStaffMember } from './components/examples'
import type { StaffRemoval } from './staff-api'
import {
  activityNameOf,
  afterStaffRemoval,
  bookingsNameOf,
  bufferNameOf,
  commissionNameOf,
  fullStaffNameOf,
  isOwnStaffRecord,
  LEVEL_OPTIONS,
  levelNameOf,
  mayKeepStaffLedger,
  staffCalled,
  staffNameOf,
} from './staff-format'

describe('levelNameOf', () => {
  it.each<[ModelsStaffLevelType, string]>([
    ['junior', 'ジュニア'],
    ['stylist', 'スタイリスト'],
    ['senior', 'シニア'],
    ['expert', 'エキスパート'],
    ['director', 'ディレクター'],
  ])('should name the level %s', (level, name) => {
    expect(levelNameOf(level)).toBe(name)
  })

  it('should offer the levels in the order of the contract', () => {
    expect(LEVEL_OPTIONS.map(({ value }) => value)).toEqual([
      'junior',
      'stylist',
      'senior',
      'expert',
      'director',
    ])
  })
})

describe('the names of a member', () => {
  it('should name a member family name first, with the kana there is', () => {
    expect([
      staffNameOf(aStaffMember()),
      fullStaffNameOf(aStaffMember()),
      fullStaffNameOf(aStaffMember({ firstNameKana: null })),
      fullStaffNameOf(aNewMember()),
      staffCalled(aStaffMember()),
    ]).toEqual([
      '田中 美咲',
      '田中 美咲（タナカ ミサキ）',
      '田中 美咲（タナカ）',
      '佐藤 健',
      '田中 美咲 さん',
    ])
  })
})

describe('what the ledger keeps of a member, in words', () => {
  it('should say whether a member is active and takes bookings', () => {
    expect([
      activityNameOf(aStaffMember()),
      activityNameOf(aNewMember()),
      bookingsNameOf(aStaffMember()),
      bookingsNameOf(aNewMember()),
    ]).toEqual(['有効', '無効', '受ける', '受けない'])
  })

  it.each<[number, string]>([
    [10, '10%'],
    [12.5, '12.5%'],
    [0.01, '0.01%'],
    [0, '0%'],
  ])('should write the rate %s to two decimal places', (rate, name) => {
    expect(commissionNameOf(rate)).toBe(name)
  })

  it.each<[number, string]>([
    [0, 'なし'],
    [15, '15 分'],
  ])('should write the time %s kept around a booking', (minutes, name) => {
    expect(bufferNameOf(minutes)).toBe(name)
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
      expect(isOwnStaffRecord({ userId }, signedIn)).toBe(own)
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
    expect(mayKeepStaffLedger(role)).toBe(keeps)
  })
})

describe('afterStaffRemoval', () => {
  it.each<[string, StaffRemoval, ReturnType<typeof afterStaffRemoval>]>([
    [
      'a removal',
      { type: 'removed' },
      {
        type: 'done',
        message: '田中 美咲 さんを、スタッフ台帳から削除しました。',
      },
    ],
    [
      'bookings that name the member',
      { type: 'busy' },
      {
        type: 'refused',
        message:
          '田中 美咲 さんは、終わっていない予約（下書き、確定待ち、確定、施術中）を担当しているため、削除できません。予約を完了するか、キャンセルするか、日時の変更で担当をほかのスタッフに替えてから、削除してください。',
      },
    ],
    ['a member removed meanwhile', { type: 'notFound' }, { type: 'gone' }],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      {
        type: 'refused',
        message:
          'このアカウントでは、このサロンのスタッフを削除できません。スタッフ台帳を扱えるのは、サロンのオーナーと管理者です。',
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
      'a failure',
      { type: 'failed' },
      {
        type: 'again',
        message:
          'スタッフを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what came of %s', (_case, outcome, says) => {
    expect(afterStaffRemoval(outcome, '田中 美咲 さん')).toEqual(says)
  })
})
