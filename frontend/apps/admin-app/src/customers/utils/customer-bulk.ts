import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerBulkUpdateItem,
  ModelsCustomerResponse,
} from '@beauty-salon-frontend/api-client'
import {
  type FormErrors,
  type FormRead,
  textOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { customerNameOf } from '../api/customers-api'
import { TAG_SEPARATORS } from './customer-ledger'

const { bulk: words, refusals } = adminCustomerMessages

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

/** The change of tags of the dialog: one tag, without the characters that separate tags. */
export const readTagChange = (
  values: FormData,
): FormRead<TagChange, FormErrors<LocalizedText>> => {
  const tag = textOf(values, TAG).trim()
  const error = match(tag)
    .returnType<LocalizedText | undefined>()
    .with('', () => words.tag.missing)
    .when(
      (text) => TAG_SEPARATORS.test(text),
      () => words.tag.oneAtATime,
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
  | { type: 'done'; message: LocalizedText; clear: boolean }
  /** It was not done: what the dialog says */
  | { type: 'again'; message: LocalizedText }
  /** Some chosen customers left the ledger: they leave the choice, and the ledger is read again */
  | { type: 'gone'; message: LocalizedText; ids: string[] }

/**
 * The names of the chosen customers of the IDs, in the order they were
 * chosen: 「山田 花子」. The IDs are some of those that were sent, which are
 * those of the chosen customers.
 */
const namesOf = (chosen: Chosen, ids: readonly string[]): string[] =>
  [...chosen.values()].filter(({ id }) => ids.includes(id)).map(customerNameOf)

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
          ? words.retagging.added(count, tag)
          : words.retagging.removed(count, tag),
      clear: false,
    }))
    .with({ type: 'unchanged' }, () => ({
      type: 'done',
      message:
        way === 'add'
          ? words.retagging.addedAlready(tag)
          : words.retagging.noneHave(tag),
      clear: false,
    }))
    .with({ type: 'gone' }, ({ ids }) => ({
      type: 'gone',
      message: words.gone(namesOf(chosen, ids), words.retagging.unchanged),
      ids,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: refusals.cannotHandle,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: words.retagging.failed,
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
      message: words.removing.removed(count),
      clear: true,
    }))
    .with({ type: 'unfinished' }, ({ id }) => {
      const customer = id === undefined ? undefined : chosen.get(id)
      return {
        type: 'again',
        message: words.removing.unfinished(
          customer === undefined ? undefined : customerNameOf(customer),
        ),
      }
    })
    .with({ type: 'gone' }, ({ ids }) => ({
      type: 'gone',
      message: words.gone(namesOf(chosen, ids), words.removing.nobodyRemoved),
      ids,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: words.removing.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: words.removing.failed,
    }))
    .exhaustive()
