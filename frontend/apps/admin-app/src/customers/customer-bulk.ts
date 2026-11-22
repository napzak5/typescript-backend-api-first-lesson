import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerBulkUpdateItem,
  ModelsCustomerResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  type FormRead,
  textOf,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { customerNameOf } from './customers-api'

/*
 * What is done at once to the customers chosen in the ledger: a tag given
 * or taken away, and a removal from the ledger.
 */

/** Who are written at once at most: the API takes 100 */
export const MOST_CHOSEN = 100

/** The customers chosen in the ledger, by ID, as the rows showed them */
export type Chosen = ReadonlyMap<string, ModelsCustomerResponse>

export const NONE_CHOSEN: Chosen = new Map()

/** The chosen customers with one more, or one less. */
export const choose = (
  chosen: Chosen,
  customer: ModelsCustomerResponse,
  wanted: boolean,
): Chosen =>
  new Map(
    wanted
      ? [...chosen, [customer.id, customer]]
      : [...chosen].filter(([id]) => id !== customer.id),
  )

/** The chosen customers but those who are no longer in the ledger. */
export const withoutGone = (chosen: Chosen, gone: readonly string[]): Chosen =>
  new Map([...chosen].filter(([id]) => !gone.includes(id)))

/** Whether a tag is given to the chosen customers or taken from them */
type TagWay = 'add' | 'remove'

export type TagChange = { way: TagWay; tag: string }

/** The control that holds the way, and the one that holds the tag */
export const TAG_WAY = 'way'
export const TAG = 'tag'

/** The characters the form of a customer separates tags with */
const SEPARATORS = /[,、，]/

/** The change of tags of the dialog: one tag, without the characters that separate tags. */
export const readTagChange = (values: FormData): FormRead<TagChange> => {
  const tag = textOf(values, TAG).trim()
  const error = match(tag)
    .returnType<string | undefined>()
    .with('', () => 'タグを入力してください。')
    .when(
      (text) => SEPARATORS.test(text),
      () => 'タグは 1 つずつ入力してください。「、」とカンマは使えません。',
    )
    .otherwise(() => undefined)

  return error === undefined
    ? {
        type: 'valid',
        value: {
          way: textOf(values, TAG_WAY) === 'remove' ? 'remove' : 'add',
          tag,
        },
      }
    : { type: 'invalid', errors: { [TAG]: error } }
}

/**
 * What is sent to change the tags of customers as they are now: only those
 * whose tags change, each with every tag they keep.
 */
export const retaggingOf = (
  customers: readonly ModelsCustomerResponse[],
  { way, tag }: TagChange,
): ModelsCustomerBulkUpdateItem[] =>
  customers.flatMap(({ id, tags }) =>
    match(way)
      .returnType<ModelsCustomerBulkUpdateItem[]>()
      .with('add', () =>
        tags.includes(tag) ? [] : [{ id, updates: { tags: [...tags, tag] } }],
      )
      .with('remove', () =>
        tags.includes(tag)
          ? [{ id, updates: { tags: tags.filter((kept) => kept !== tag) } }]
          : [],
      )
      .exhaustive(),
  )

/** What came of changing a tag of the chosen customers */
export type RetagAttempt =
  | { type: 'retagged'; count: number }
  /** Every chosen customer already was as asked: nothing was sent */
  | { type: 'unchanged' }
  /** Some chosen customers are no longer in the ledger: nobody was changed */
  | { type: 'gone'; ids: string[] }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What came of removing the chosen customers from the ledger */
export type RemovalAttempt =
  | { type: 'removed'; count: number }
  /** A customer has bookings that are not finished, the one the API names when it is chosen: nobody was removed */
  | { type: 'unfinished'; id: string | undefined }
  /** Some chosen customers are no longer in the ledger: nobody was removed */
  | { type: 'gone'; ids: string[] }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What the ledger says after a write of the chosen customers */
export type BulkSays =
  /** It was done: the notification, and whether the choice is over */
  | { type: 'done'; message: string; clear: boolean }
  /** It was not done: what the dialog says */
  | { type: 'again'; message: string }
  /** Some chosen customers left the ledger: they leave the choice, and the ledger is read again */
  | { type: 'gone'; message: string; ids: string[] }

/** The chosen customers that are named: 「山田 花子 様、鈴木 一郎 様」. */
const namesOf = (chosen: Chosen, ids: readonly string[]): string =>
  ids
    .flatMap((id) => {
      const customer = chosen.get(id)
      return customer === undefined ? [] : [`${customerNameOf(customer)} 様`]
    })
    .join('、')

const goneMessageOf = (
  chosen: Chosen,
  ids: readonly string[],
  untouched: string,
): string =>
  `選んだお客様のうち、${namesOf(chosen, ids)}は、もう台帳にいません。そのお客様を選ぶのをやめ、台帳を読み直しました。${untouched}`

/** What the ledger says after the tag of the chosen customers was changed, or not. */
export const afterRetagging = (
  attempt: RetagAttempt,
  { way, tag }: TagChange,
  chosen: Chosen,
): BulkSays =>
  match(attempt)
    .returnType<BulkSays>()
    .with({ type: 'retagged' }, ({ count }) => ({
      type: 'done',
      message:
        way === 'add'
          ? `${count} 人にタグ「${tag}」を付けました。`
          : `${count} 人からタグ「${tag}」を外しました。`,
      clear: false,
    }))
    .with({ type: 'unchanged' }, () => ({
      type: 'done',
      message:
        way === 'add'
          ? `選んだお客様には、もうタグ「${tag}」が付いています。`
          : `選んだお客様に、タグ「${tag}」の付いた人はいません。`,
      clear: false,
    }))
    .with({ type: 'gone' }, ({ ids }) => ({
      type: 'gone',
      message: goneMessageOf(chosen, ids, 'だれのタグも変えていません。'),
      ids,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: 'このアカウントでは、顧客台帳を扱えません。',
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE).message ?? '',
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'タグを変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()

/** What the ledger says after the chosen customers were removed, or not. */
export const afterRemoval = (
  attempt: RemovalAttempt,
  chosen: Chosen,
): BulkSays =>
  match(attempt)
    .returnType<BulkSays>()
    .with({ type: 'removed' }, ({ count }) => ({
      type: 'done',
      message: `${count} 人を台帳から削除しました。`,
      clear: true,
    }))
    .with({ type: 'unfinished' }, ({ id }) => {
      const customer = id === undefined ? undefined : chosen.get(id)
      return {
        type: 'again',
        message: `${
          customer === undefined
            ? '選んだお客様のなかに、終わっていない予約のあるお客様がいます。'
            : `${customerNameOf(customer)} 様には、終わっていない予約があります。`
        }予約を完了、キャンセル、または削除してから、もう一度お試しください。だれも削除していません。`,
      }
    })
    .with({ type: 'gone' }, ({ ids }) => ({
      type: 'gone',
      message: goneMessageOf(chosen, ids, 'だれも削除していません。'),
      ids,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message:
        'このアカウントでは、お客様を台帳から削除できません。台帳からの削除は、オーナーとマネージャーができます。',
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE).message ?? '',
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '台帳から削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
