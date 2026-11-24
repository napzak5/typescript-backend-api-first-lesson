import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminOperationMessages } from './index'

const { erasure, expiry, purge, runs, system } = adminOperationMessages

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminOperationMessages.system.notReadyFor',
    system.notReadyFor(system.dependencies.database),
    {
      en: 'Not accepting (Database cannot be reached)',
      ja: '受け付けていません（データベースに接続できません）',
    },
  ],
  [
    'adminOperationMessages.system.millisecondsOf',
    system.millisecondsOf(3002),
    { en: '3,002 ms', ja: '3,002 ミリ秒' },
  ],
  [
    'adminOperationMessages.runs.ranAt',
    runs.ranAt(
      {
        en: 'Fri, November 20, 2026 at 12:00',
        ja: '2026年11月20日（金） 12:00',
      },
      purge.none,
    ),
    {
      en: 'Ran on Fri, November 20, 2026 at 12:00. There were no attachments to remove.',
      ja: '2026年11月20日（金） 12:00に実行しました。消す添付ファイルはありませんでした。',
    },
  ],
  [
    'adminOperationMessages.expiry.done',
    expiry.done(3, 1250),
    {
      en: 'Expired 1,250 points of 3 customers in all.',
      ja: '3 人のお客様の、合わせて 1,250 ポイントを失効させました。',
    },
  ],
  [
    'adminOperationMessages.erasure.done',
    erasure.done(2),
    {
      en: 'Carried out 2 requests, and erased the data of the customers. Let each customer know through the salon that took the request.',
      ja: '2 件の依頼を実行して、お客様のデータを消去しました。消去したことは、依頼を受け付けたサロンから本人に知らせてください。',
    },
  ],
  [
    'adminOperationMessages.purge.done',
    purge.done(4),
    {
      en: 'Removed 4 attachments, stored files included.',
      ja: '4 件の添付ファイルを、保存先のファイルと一緒に消しました。',
    },
  ],
]

describe('the messages of the operations of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminOperationMessages }, '').made.toSorted(),
    )
  })

  it.each<[string, LocalizedText, LocalizedText]>([
    [
      'customer and one point',
      expiry.done(1, 1),
      {
        en: 'Expired 1 point of 1 customer in all.',
        ja: '1 人のお客様の、合わせて 1 ポイントを失効させました。',
      },
    ],
    [
      'request',
      erasure.done(1),
      {
        en: 'Carried out 1 request, and erased the data of the customers. Let each customer know through the salon that took the request.',
        ja: '1 件の依頼を実行して、お客様のデータを消去しました。消去したことは、依頼を受け付けたサロンから本人に知らせてください。',
      },
    ],
    [
      'attachment',
      purge.done(1),
      {
        en: 'Removed 1 attachment, stored files included.',
        ja: '1 件の添付ファイルを、保存先のファイルと一緒に消しました。',
      },
    ],
  ])(
    'should count one %s as one in English, and with the same word in Japanese',
    (_what, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )
})
