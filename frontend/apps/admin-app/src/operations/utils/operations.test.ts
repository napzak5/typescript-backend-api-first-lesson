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

const TOO_MANY_REQUESTS = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}

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
  it.each<[Liveness, string, string]>([
    [{ type: 'alive' }, 'Running', '動いています'],
    [{ type: 'silent' }, 'No answer', '応答がありません'],
  ])('should say whether the process answers: %o', (liveness, en, ja) => {
    expect(livenessNameOf(liveness)).toEqual({ en, ja })
  })

  it.each<[Readiness, string, string]>([
    [{ type: 'ready' }, 'Accepting', '受け付けています'],
    [
      { type: 'notReady', reason: 'database' },
      'Not accepting (Database cannot be reached)',
      '受け付けていません（データベースに接続できません）',
    ],
    [
      { type: 'notReady', reason: 'cache' },
      'Not accepting (cache cannot be reached)',
      '受け付けていません（cacheに接続できません）',
    ],
    [{ type: 'notReady', reason: null }, 'Not accepting', '受け付けていません'],
    [{ type: 'silent' }, 'No answer', '応答がありません'],
  ])('should say whether the API takes requests: %o', (readiness, en, ja) => {
    expect(readinessNameOf(readiness)).toEqual({ en, ja })
  })

  it.each<['healthy' | 'degraded' | 'unhealthy', string, string]>([
    ['healthy', 'Healthy', '正常です'],
    ['degraded', 'Degraded', '性能が落ちています'],
    ['unhealthy', 'Down', '止まっています'],
  ])('should name the state %s of the API', (status, en, ja) => {
    expect(healthNameOf(status)).toEqual({ en, ja })
  })

  it.each<['up' | 'down' | 'degraded', string, string]>([
    ['up', 'Up', '動いています'],
    ['down', 'Down', '止まっています'],
    ['degraded', 'Degraded', '性能が落ちています'],
  ])(
    'should name the state %s of what the API depends on',
    (status, en, ja) => {
      expect(checkNameOf(status)).toEqual({ en, ja })
    },
  )

  it('should name the database, and what it does not know by the name the API gives', () => {
    expect([dependencyNameOf('database'), dependencyNameOf('cache')]).toEqual([
      { en: 'Database', ja: 'データベース' },
      { en: 'cache', ja: 'cache' },
    ])
  })

  it('should say how long the API waited with the separators of the language, or that it could not tell', () => {
    expect([
      responseTimeNameOf(4),
      responseTimeNameOf(3002),
      responseTimeNameOf(null),
    ]).toEqual([
      { en: '4 ms', ja: '4 ミリ秒' },
      { en: '3,002 ms', ja: '3,002 ミリ秒' },
      { en: 'Could not be measured', ja: '測れませんでした' },
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
        message: {
          en: 'Could not finish expiring the points. If it stopped partway, the points up to then are expired. Check your connection: running it again expires the rest.',
          ja: 'ポイントの失効を終えられませんでした。途中で止まったときも、それまでの分は失効させてあります。通信の状態を確かめて、もう一度実行すると、残りを失効させます。',
        },
      },
    ],
  ])('should say why nothing may have been done after %o', (outcome, says) => {
    expect(afterExpiry(outcome)).toEqual(says)
  })

  it('should tell an account that does not run the platform who does', () => {
    expect(ADMINISTRATORS_ONLY).toEqual({
      en: 'This account cannot run the operations. Only an administrator checks the state of the system, expires points, carries out the requests to erase data and cleans up the attachments.',
      ja: 'このアカウントでは、運用の操作を行えません。システムの状態を確かめ、ポイントの失効、データの消去の依頼の実行、添付ファイルの掃除を行うのは、管理者です。',
    })
  })

  it.each<[number, number, string, string]>([
    [
      0,
      0,
      'There were no points to expire.',
      '失効させるポイントはありませんでした。',
    ],
    [
      1,
      300,
      'Expired 300 points of 1 customer in all.',
      '1 人のお客様の、合わせて 300 ポイントを失効させました。',
    ],
    [
      1200,
      2500000,
      'Expired 2,500,000 points of 1,200 customers in all.',
      '1,200 人のお客様の、合わせて 2,500,000 ポイントを失効させました。',
    ],
  ])(
    'should say what expiring the points of %i customers did',
    (processedCount, totalPoints, en, ja) => {
      expect(expiryResultOf({ processedCount, totalPoints })).toEqual({
        en,
        ja,
      })
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
        message: {
          en: 'Could not finish carrying out the requests to erase data. If it stopped partway, the requests up to then are carried out. Check your connection: running it again carries out the rest.',
          ja: 'データの消去の依頼の実行を終えられませんでした。途中で止まったときも、それまでの依頼は実行してあります。通信の状態を確かめて、もう一度実行すると、残りを実行します。',
        },
      },
    ],
  ])('should say why nothing may have been done after %o', (outcome, says) => {
    expect(afterErasure(outcome)).toEqual(says)
  })

  it('should say that no request was due, or how many were carried out and who tells the customers', () => {
    expect([
      erasureResultOf([]),
      erasureResultOf([aDeletionRequest()]),
      erasureResultOf([aDeletionRequest(), aDeletionRequest()]),
    ]).toEqual([
      {
        en: 'There were no requests past their scheduled time.',
        ja: '予定日時を過ぎた依頼はありませんでした。',
      },
      {
        en: 'Carried out 1 request, and erased the data of the customers. Let each customer know through the salon that took the request.',
        ja: '1 件の依頼を実行して、お客様のデータを消去しました。消去したことは、依頼を受け付けたサロンから本人に知らせてください。',
      },
      {
        en: 'Carried out 2 requests, and erased the data of the customers. Let each customer know through the salon that took the request.',
        ja: '2 件の依頼を実行して、お客様のデータを消去しました。消去したことは、依頼を受け付けたサロンから本人に知らせてください。',
      },
    ])
  })

  it('should count the requests that were carried out with the separators of the language', () => {
    expect(
      erasureResultOf(Array.from({ length: 1234 }, () => aDeletionRequest())),
    ).toEqual({
      en: 'Carried out 1,234 requests, and erased the data of the customers. Let each customer know through the salon that took the request.',
      ja: '1,234 件の依頼を実行して、お客様のデータを消去しました。消去したことは、依頼を受け付けたサロンから本人に知らせてください。',
    })
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
        message: {
          en: 'Could not finish cleaning up the attachments. If it stopped partway, the attachments up to then are removed. Check your connection: running it again removes the rest.',
          ja: '添付ファイルの掃除を終えられませんでした。途中で止まったときも、それまでの分は消してあります。通信の状態を確かめて、もう一度実行すると、残りを消します。',
        },
      },
    ],
  ])('should say why nothing may have been done after %o', (outcome, says) => {
    expect(afterPurge(outcome)).toEqual(says)
  })

  it('should say that nothing was to be removed, or how many attachments were', () => {
    expect([purgeResultOf(0), purgeResultOf(1), purgeResultOf(1200)]).toEqual([
      {
        en: 'There were no attachments to remove.',
        ja: '消す添付ファイルはありませんでした。',
      },
      {
        en: 'Removed 1 attachment, stored files included.',
        ja: '1 件の添付ファイルを、保存先のファイルと一緒に消しました。',
      },
      {
        en: 'Removed 1,200 attachments, stored files included.',
        ja: '1,200 件の添付ファイルを、保存先のファイルと一緒に消しました。',
      },
    ])
  })
})

describe('ranAtOf', () => {
  it('should say when an operation was run, then what it did', () => {
    expect(
      ranAtOf(
        {
          en: 'Fri, November 20, 2026 at 12:00',
          ja: '2026年11月20日（金） 12:00',
        },
        {
          en: 'There were no attachments to remove.',
          ja: '消す添付ファイルはありませんでした。',
        },
      ),
    ).toEqual({
      en: 'Ran on Fri, November 20, 2026 at 12:00. There were no attachments to remove.',
      ja: '2026年11月20日（金） 12:00に実行しました。消す添付ファイルはありませんでした。',
    })
  })
})
