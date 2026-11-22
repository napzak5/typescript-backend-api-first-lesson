import { describe, expect, it } from 'vitest'
import { aCustomer, customers } from '../bookings/components/examples'
import {
  afterRemoval,
  afterRetagging,
  type BulkSays,
  type Chosen,
  choose,
  NONE_CHOSEN,
  type RemovalAttempt,
  type RetagAttempt,
  readTagChange,
  retaggingOf,
  type TagChange,
  withoutGone,
} from './customer-bulk'

const [hanako = aCustomer(), ichiro = aCustomer()] = customers

const valuesOf = (entries: [string, string][]): FormData => {
  const values = new FormData()
  for (const [name, value] of entries) {
    values.append(name, value)
  }
  return values
}

const BOTH: Chosen = new Map([
  [hanako.id, hanako],
  [ichiro.id, ichiro],
])

describe('choose', () => {
  it('should add a customer, and take one away, keeping the order they were chosen in', () => {
    // Act
    const both = choose(choose(NONE_CHOSEN, ichiro, true), hanako, true)
    const one = choose(both, ichiro, false)

    // Assert
    expect([...both.keys()]).toEqual([ichiro.id, hanako.id])
    expect([...one.keys()]).toEqual([hanako.id])
  })
})

describe('withoutGone', () => {
  it('should keep the chosen customers who are still in the ledger', () => {
    // Act
    const kept = withoutGone(BOTH, [ichiro.id])

    // Assert
    expect([...kept.keys()]).toEqual([hanako.id])
  })
})

describe('readTagChange', () => {
  it.each<[string, [string, string][], TagChange]>([
    [
      'a tag to give',
      [
        ['way', 'add'],
        ['tag', ' 秋のキャンペーン '],
      ],
      { way: 'add', tag: '秋のキャンペーン' },
    ],
    [
      'a tag to take away',
      [
        ['way', 'remove'],
        ['tag', 'VIP'],
      ],
      { way: 'remove', tag: 'VIP' },
    ],
  ])('should read %s', (_, entries, change) => {
    // Act
    const read = readTagChange(valuesOf(entries))

    // Assert
    expect(read).toEqual({ type: 'valid', value: change })
  })

  it.each<[string, string, string]>([
    ['no tag', '  ', 'タグを入力してください。'],
    [
      'two tags',
      'VIP、常連',
      'タグは 1 つずつ入力してください。「、」とカンマは使えません。',
    ],
    [
      'a comma',
      'VIP,常連',
      'タグは 1 つずつ入力してください。「、」とカンマは使えません。',
    ],
  ])('should refuse %s', (_, tag, error) => {
    // Act
    const read = readTagChange(
      valuesOf([
        ['way', 'add'],
        ['tag', tag],
      ]),
    )

    // Assert
    expect(read).toEqual({ type: 'invalid', errors: { tag: error } })
  })
})

describe('retaggingOf', () => {
  const tagged = aCustomer({ id: hanako.id, tags: ['VIP', '秋'] })
  const untagged = aCustomer({ id: ichiro.id, tags: ['常連'] })

  it('should give the tag to those who lack it, with the tags they have', () => {
    // Act
    const items = retaggingOf([tagged, untagged], { way: 'add', tag: '秋' })

    // Assert
    expect(items).toEqual([
      { id: ichiro.id, updates: { tags: ['常連', '秋'] } },
    ])
  })

  it('should take the tag from those who have it, and leave their other tags', () => {
    // Act
    const items = retaggingOf([tagged, untagged], { way: 'remove', tag: '秋' })

    // Assert
    expect(items).toEqual([{ id: hanako.id, updates: { tags: ['VIP'] } }])
  })

  it('should send nobody when nobody changes', () => {
    // Act
    const items = retaggingOf([untagged], { way: 'remove', tag: '秋' })

    // Assert
    expect(items).toEqual([])
  })
})

describe('afterRetagging', () => {
  const GIVE: TagChange = { way: 'add', tag: '秋' }
  const TAKE: TagChange = { way: 'remove', tag: '秋' }

  it.each<[string, RetagAttempt, TagChange, BulkSays]>([
    [
      'a tag given',
      { type: 'retagged', count: 2 },
      GIVE,
      { type: 'done', message: '2 人にタグ「秋」を付けました。', clear: false },
    ],
    [
      'a tag taken away',
      { type: 'retagged', count: 1 },
      TAKE,
      {
        type: 'done',
        message: '1 人からタグ「秋」を外しました。',
        clear: false,
      },
    ],
    [
      'a tag every chosen customer has',
      { type: 'unchanged' },
      GIVE,
      {
        type: 'done',
        message: '選んだお客様には、もうタグ「秋」が付いています。',
        clear: false,
      },
    ],
    [
      'a tag no chosen customer has',
      { type: 'unchanged' },
      TAKE,
      {
        type: 'done',
        message: '選んだお客様に、タグ「秋」の付いた人はいません。',
        clear: false,
      },
    ],
    [
      'customers who left the ledger',
      { type: 'gone', ids: [ichiro.id] },
      GIVE,
      {
        type: 'gone',
        message:
          '選んだお客様のうち、鈴木 一郎 様は、もう台帳にいません。そのお客様を選ぶのをやめ、台帳を読み直しました。だれのタグも変えていません。',
        ids: [ichiro.id],
      },
    ],
    [
      'an account that may not',
      { type: 'forbidden' },
      GIVE,
      { type: 'again', message: 'このアカウントでは、顧客台帳を扱えません。' },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      GIVE,
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'no answer',
      { type: 'failed' },
      GIVE,
      {
        type: 'again',
        message:
          'タグを変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what follows %s', (_, attempt, change, says) => {
    // Act
    const said = afterRetagging(attempt, change, BOTH)

    // Assert
    expect(said).toEqual(says)
  })
})

describe('afterRemoval', () => {
  it.each<[string, RemovalAttempt, BulkSays]>([
    [
      'customers removed',
      { type: 'removed', count: 2 },
      { type: 'done', message: '2 人を台帳から削除しました。', clear: true },
    ],
    [
      'a chosen customer with bookings that are not finished',
      { type: 'unfinished', id: ichiro.id },
      {
        type: 'again',
        message:
          '鈴木 一郎 様には、終わっていない予約があります。予約を完了、キャンセル、または削除してから、もう一度お試しください。だれも削除していません。',
      },
    ],
    [
      'bookings not finished, of a customer the API does not name',
      { type: 'unfinished', id: undefined },
      {
        type: 'again',
        message:
          '選んだお客様のなかに、終わっていない予約のあるお客様がいます。予約を完了、キャンセル、または削除してから、もう一度お試しください。だれも削除していません。',
      },
    ],
    [
      'customers who left the ledger',
      { type: 'gone', ids: [hanako.id, ichiro.id] },
      {
        type: 'gone',
        message:
          '選んだお客様のうち、山田 花子 様、鈴木 一郎 様は、もう台帳にいません。そのお客様を選ぶのをやめ、台帳を読み直しました。だれも削除していません。',
        ids: [hanako.id, ichiro.id],
      },
    ],
    [
      'an account that may not',
      { type: 'forbidden' },
      {
        type: 'again',
        message:
          'このアカウントでは、お客様を台帳から削除できません。台帳からの削除は、オーナーとマネージャーができます。',
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
          '台帳から削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what follows %s', (_, attempt, says) => {
    // Act
    const said = afterRemoval(attempt, BOTH)

    // Assert
    expect(said).toEqual(says)
  })
})
