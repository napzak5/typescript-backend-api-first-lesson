import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { followed, listed } from '../written'
import { customersOf, honored } from './customer-words'

/*
 * What is done at once to the customers chosen in the ledger: a tag given
 * or taken away, and a removal from the ledger. The names of the
 * customers and the tags stand as they were written.
 */

const NOBODY_REMOVED = text({
  en: 'Nobody was removed.',
  ja: 'だれも削除していません。',
})
const FINISH_THEM = text({
  en: 'Complete, cancel or delete those bookings, then try again.',
  ja: '予約を完了、キャンセル、または削除してから、もう一度お試しください。',
})

export const customerBulkMessages = {
  /** The part of the ledger that holds the choice */
  chosen: {
    none: text({ en: 'No customers chosen', ja: '選んだお客様はいません' }),
    count: (count: number) =>
      text({
        en: `${customersOf(count).en} chosen`,
        ja: `${customersOf(count).ja}を選んでいます`,
      }),
    aboutWithRemoval: text({
      en: 'Choose customers in the table to add or remove a tag, or to remove them from the ledger, all at once.',
      ja: '表でお客様を選ぶと、まとめてタグを付けたり外したり、台帳から削除したりできます。',
    }),
    about: text({
      en: 'Choose customers in the table to add or remove a tag, all at once.',
      ja: '表でお客様を選ぶと、まとめてタグを付けたり外したりできます。',
    }),
    tooMany: (most: number) =>
      text({
        en: `Up to ${customersOf(most).en} can be handled at once. Choose fewer customers.`,
        ja: `一度に操作できるのは ${customersOf(most).ja}までです。選ぶお客様を減らしてください。`,
      }),
    retag: text({ en: 'Add or remove a tag', ja: 'タグを付ける・外す' }),
    remove: text({ en: 'Remove from the ledger', ja: '台帳から削除する' }),
    clear: text({ en: 'Clear the choice', ja: '選ぶのをやめる' }),
  },
  /** The dialog that gives a tag to the chosen customers, or takes it from them */
  tag: {
    title: (count: number) =>
      text({
        en: `Tag of the chosen customers (${numberOf(count).en})`,
        ja: `選んだ ${customersOf(count).ja}のタグ`,
      }),
    description: text({
      en: 'Choose whether to add or remove the tag, and enter one tag. The other tags of the customers stay as they are.',
      ja: 'タグを付けるか外すかを選び、タグを 1 つ入力します。お客様のほかのタグは、そのまま残ります。',
    }),
    apply: text({ en: 'Apply', ja: '反映する' }),
    way: text({ en: 'The tag', ja: 'タグを' }),
    add: text({ en: 'Add', ja: '付ける' }),
    remove: text({ en: 'Remove', ja: '外す' }),
    tag: text({ en: 'Tag', ja: 'タグ' }),
    example: text({
      en: 'For example: Autumn campaign',
      ja: '例: 秋のキャンペーン',
    }),
    missing: text({ en: 'Enter a tag.', ja: 'タグを入力してください。' }),
    oneAtATime: text({
      en: 'Enter one tag at a time. Commas cannot be used.',
      ja: 'タグは 1 つずつ入力してください。「、」とカンマは使えません。',
    }),
  },
  /** The dialog that removes the chosen customers from the ledger */
  removal: {
    title: (count: number) =>
      text({
        en: `Remove ${customersOf(count).en} from the ledger?`,
        ja: `${customersOf(count).ja}のお客様を台帳から削除しますか？`,
      }),
    description: text({
      en: 'These customers can no longer be chosen in the customer ledger and in bookings. Their bookings and sales are kept.',
      ja: '顧客台帳と予約で、これらのお客様を選べなくなります。予約と売上の記録は残ります。',
    }),
    list: text({ en: 'Customers to remove', ja: '削除するお客様' }),
    back: uiMessages.back,
    confirm: text({ en: 'Remove', ja: '削除する' }),
  },
  /** What the ledger says after the tag of the chosen customers was changed, or not */
  retagging: {
    added: (count: number, tag: string) =>
      text({
        en: `Added the tag “${tag}” to ${customersOf(count).en}.`,
        ja: `${customersOf(count).ja}にタグ「${tag}」を付けました。`,
      }),
    removed: (count: number, tag: string) =>
      text({
        en: `Removed the tag “${tag}” from ${customersOf(count).en}.`,
        ja: `${customersOf(count).ja}からタグ「${tag}」を外しました。`,
      }),
    addedAlready: (tag: string) =>
      text({
        en: `The chosen customers already have the tag “${tag}”.`,
        ja: `選んだお客様には、もうタグ「${tag}」が付いています。`,
      }),
    noneHave: (tag: string) =>
      text({
        en: `None of the chosen customers has the tag “${tag}”.`,
        ja: `選んだお客様に、タグ「${tag}」の付いた人はいません。`,
      }),
    unchanged: text({
      en: 'No tags were changed.',
      ja: 'だれのタグも変えていません。',
    }),
    failed: text({
      en: 'The tags could not be changed. Check your connection and try again.',
      ja: 'タグを変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** What the ledger says after the chosen customers were removed, or not */
  removing: {
    removed: (count: number) =>
      text({
        en: `Removed ${customersOf(count).en} from the ledger.`,
        ja: `${customersOf(count).ja}を台帳から削除しました。`,
      }),
    /** A customer has bookings that are not finished: the one the API names, when they are chosen */
    unfinished: (name: string | undefined) =>
      followed(
        name === undefined
          ? text({
              en: 'Some of the chosen customers have bookings that are not finished.',
              ja: '選んだお客様のなかに、終わっていない予約のあるお客様がいます。',
            })
          : text({
              en: `${name} has bookings that are not finished.`,
              ja: `${name} 様には、終わっていない予約があります。`,
            }),
        FINISH_THEM,
        NOBODY_REMOVED,
      ),
    nobodyRemoved: NOBODY_REMOVED,
    forbidden: text({
      en: 'This account cannot remove customers from the ledger. Owners and managers remove customers from the ledger.',
      ja: 'このアカウントでは、お客様を台帳から削除できません。台帳からの削除は、オーナーとマネージャーができます。',
    }),
    failed: text({
      en: 'The customers could not be removed from the ledger. Check your connection and try again.',
      ja: '台帳から削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** Some chosen customers left the ledger: they leave the choice, and what was not done follows */
  gone: (names: readonly string[], undone: LocalizedText) =>
    followed(
      text({
        en: `No longer in the ledger: ${listed(names.map(honored)).en}. They are no longer chosen, and the ledger was loaded again.`,
        ja: `選んだお客様のうち、${listed(names.map(honored)).ja}は、もう台帳にいません。そのお客様を選ぶのをやめ、台帳を読み直しました。`,
      }),
      undone,
    ),
}
