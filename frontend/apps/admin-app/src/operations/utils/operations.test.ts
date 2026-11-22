import type { ModelsUserRoleType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import type { Liveness, Readiness } from '../api/operations-api'
import { aDeletionRequest } from '../components/examples'
import {
  ADMINISTRATORS_ONLY,
  afterErasure,
  afterExpiry,
  afterPurge,
  checkNameOf,
  dependencyNameOf,
  erasureResultOf,
  expiryResultOf,
  healthNameOf,
  livenessNameOf,
  purgeResultOf,
  ranAtOf,
  readinessNameOf,
  responseTimeNameOf,
  runsOperations,
} from './operations'

const TOO_MANY_REQUESTS =
  'アクセスが多すぎます。しばらくしてから、もう一度お試しください。'

describe('runsOperations', () => {
  it.each<[ModelsUserRoleType, boolean]>([
    ['admin', true],
    ['owner', false],
    ['manager', false],
    ['staff', false],
    ['customer', false],
  ])('should let %s run the platform: %s', (role, runs) => {
    expect(runsOperations(role)).toBe(runs)
  })
})

describe('the state of the system, in words', () => {
  it.each<[Liveness, string]>([
    [{ type: 'alive' }, '動いています'],
    [{ type: 'silent' }, '応答がありません'],
  ])('should say whether the process answers: %o', (liveness, words) => {
    expect(livenessNameOf(liveness)).toBe(words)
  })

  it.each<[Readiness, string]>([
    [{ type: 'ready' }, '受け付けています'],
    [
      { type: 'notReady', reason: 'database' },
      '受け付けていません（データベースに接続できません）',
    ],
    [
      { type: 'notReady', reason: 'cache' },
      '受け付けていません（cacheに接続できません）',
    ],
    [{ type: 'notReady', reason: null }, '受け付けていません'],
    [{ type: 'silent' }, '応答がありません'],
  ])('should say whether the API takes requests: %o', (readiness, words) => {
    expect(readinessNameOf(readiness)).toBe(words)
  })

  it.each<['healthy' | 'degraded' | 'unhealthy', string]>([
    ['healthy', '正常です'],
    ['degraded', '性能が落ちています'],
    ['unhealthy', '止まっています'],
  ])('should name the state %s of the API', (status, words) => {
    expect(healthNameOf(status)).toBe(words)
  })

  it.each<['up' | 'down' | 'degraded', string]>([
    ['up', '動いています'],
    ['down', '止まっています'],
    ['degraded', '性能が落ちています'],
  ])('should name the state %s of what the API depends on', (status, words) => {
    expect(checkNameOf(status)).toBe(words)
  })

  it('should name the database, and what it does not know by the name the API gives', () => {
    expect([dependencyNameOf('database'), dependencyNameOf('cache')]).toEqual([
      'データベース',
      'cache',
    ])
  })

  it('should say how long the API waited, or that it could not tell', () => {
    expect([responseTimeNameOf(4), responseTimeNameOf(null)]).toEqual([
      '4 ミリ秒',
      '測れませんでした',
    ])
  })
})

describe('afterExpiry', () => {
  it('should show what was expired', () => {
    expect(
      afterExpiry({ type: 'expired', processedCount: 3, totalPoints: 1250 }),
    ).toEqual({
      type: 'done',
      result: { processedCount: 3, totalPoints: 1250 },
    })
  })

  it.each<[Parameters<typeof afterExpiry>[0], unknown]>([
    [{ type: 'forbidden' }, { type: 'refused', message: ADMINISTRATORS_ONLY }],
    [
      { type: 'tooManyRequests' },
      { type: 'again', message: TOO_MANY_REQUESTS },
    ],
    [
      { type: 'failed' },
      {
        type: 'again',
        message:
          'ポイントの失効を終えられませんでした。途中で止まったときも、それまでの分は失効させてあります。通信の状態を確かめて、もう一度実行すると、残りを失効させます。',
      },
    ],
  ])('should say why nothing may have been done after %o', (outcome, says) => {
    expect(afterExpiry(outcome)).toEqual(says)
  })

  it.each<[number, number, string]>([
    [0, 0, '失効させるポイントはありませんでした。'],
    [1, 300, '1 人のお客様の、合わせて 300 ポイントを失効させました。'],
    [
      1200,
      2500000,
      '1,200 人のお客様の、合わせて 2,500,000 ポイントを失効させました。',
    ],
  ])(
    'should say what expiring the points of %i customers did',
    (processedCount, totalPoints, words) => {
      expect(expiryResultOf({ processedCount, totalPoints })).toBe(words)
    },
  )
})

describe('afterErasure', () => {
  it('should show the requests that were carried out', () => {
    const requests = [aDeletionRequest()]

    expect(afterErasure({ type: 'erased', requests })).toEqual({
      type: 'done',
      result: requests,
    })
  })

  it.each<[Parameters<typeof afterErasure>[0], unknown]>([
    [{ type: 'forbidden' }, { type: 'refused', message: ADMINISTRATORS_ONLY }],
    [
      { type: 'tooManyRequests' },
      { type: 'again', message: TOO_MANY_REQUESTS },
    ],
    [
      { type: 'failed' },
      {
        type: 'again',
        message:
          'データの消去の依頼の実行を終えられませんでした。途中で止まったときも、それまでの依頼は実行してあります。通信の状態を確かめて、もう一度実行すると、残りを実行します。',
      },
    ],
  ])('should say why nothing may have been done after %o', (outcome, says) => {
    expect(afterErasure(outcome)).toEqual(says)
  })

  it('should say that no request was due, or how many were carried out and who tells the customers', () => {
    expect([
      erasureResultOf([]),
      erasureResultOf([aDeletionRequest(), aDeletionRequest()]),
    ]).toEqual([
      '予定日時を過ぎた依頼はありませんでした。',
      '2 件の依頼を実行して、お客様のデータを消去しました。消去したことは、依頼を受け付けたサロンから本人に知らせてください。',
    ])
  })
})

describe('afterPurge', () => {
  it('should show how many attachments were removed', () => {
    expect(afterPurge({ type: 'purged', purgedCount: 4 })).toEqual({
      type: 'done',
      result: 4,
    })
  })

  it.each<[Parameters<typeof afterPurge>[0], unknown]>([
    [{ type: 'forbidden' }, { type: 'refused', message: ADMINISTRATORS_ONLY }],
    [
      { type: 'tooManyRequests' },
      { type: 'again', message: TOO_MANY_REQUESTS },
    ],
    [
      { type: 'failed' },
      {
        type: 'again',
        message:
          '添付ファイルの掃除を終えられませんでした。途中で止まったときも、それまでの分は消してあります。通信の状態を確かめて、もう一度実行すると、残りを消します。',
      },
    ],
  ])('should say why nothing may have been done after %o', (outcome, says) => {
    expect(afterPurge(outcome)).toEqual(says)
  })

  it('should say that nothing was to be removed, or how many attachments were', () => {
    expect([purgeResultOf(0), purgeResultOf(1200)]).toEqual([
      '消す添付ファイルはありませんでした。',
      '1,200 件の添付ファイルを、保存先のファイルと一緒に消しました。',
    ])
  })
})

describe('ranAtOf', () => {
  it('should say when an operation was run, then what it did', () => {
    expect(
      ranAtOf(
        '2026年11月20日（金） 12:00',
        '消す添付ファイルはありませんでした。',
      ),
    ).toBe(
      '2026年11月20日（金） 12:00に実行しました。消す添付ファイルはありませんでした。',
    )
  })
})
