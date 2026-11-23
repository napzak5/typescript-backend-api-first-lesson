import { type LocalizedText, text } from '../../languages/localized-text'
import { INVENTORY_WORDS, LOOK_AGAIN } from './inventory-words'

/*
 * The movements of the stock of a row: their kinds, the form that records
 * one with what it says when the API did not take it, the history and its
 * filter. The unit of a product and the reason of a movement stand as they
 * were written.
 */

const TITLE = text({ en: 'Stock movements', ja: '在庫の移動' })
const KIND = text({ en: 'Kind', ja: '区分' })
const RECEIPT = text({ en: 'Receipt of a purchase order', ja: '発注の入荷' })
const FAILED = text({
  en: 'The stock movement could not be recorded. Check your connection and try again.',
  ja: '在庫の移動を記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
})

export const inventoryMovementMessages = {
  title: TITLE,
  entryTitle: INVENTORY_WORDS.recordMovement,
  /** The kinds of a movement, by the values of the API */
  kinds: {
    purchase: text({ en: 'Purchase', ja: '仕入れ' }),
    use: text({ en: 'Used in a treatment', ja: '施術で使用' }),
    sale: text({ en: 'Retail sale', ja: '店頭販売' }),
    return: text({ en: 'Return', ja: '返品' }),
    adjustment: text({ en: 'Adjustment', ja: '在庫の調整' }),
    disposal: text({ en: 'Disposal', ja: '廃棄' }),
    transfer: text({ en: 'Transfer between salons', ja: 'サロン間の移動' }),
  },
  /**
   * Why a movement was made: what it says, as it was written, or that it
   * received a purchase order (`ofAnOrder`) when it says nothing; `null`
   * when there is nothing to say
   */
  reasonOf: (reason: string | null, ofAnOrder: boolean) =>
    reason === null
      ? ofAnOrder
        ? RECEIPT
        : null
      : text({ en: reason, ja: reason }),
  /** How a movement changed the stock: 「+12 tube」, 「−2.5 tube」 */
  increase: (quantity: LocalizedText) =>
    text({ en: `+${quantity.en}`, ja: `+${quantity.ja}` }),
  decrease: (quantity: LocalizedText) =>
    text({ en: `−${quantity.en}`, ja: `−${quantity.ja}` }),
  /** The form of a movement */
  form: {
    part: TITLE,
    /** The row and its stock, above the controls */
    about: (
      row: LocalizedText,
      current: LocalizedText,
      available: LocalizedText,
    ) =>
      text({
        en: `${row.en}. In stock now: ${current.en}, of which ${available.en} available.`,
        ja: `${row.ja}。いまの在庫数は ${current.ja}、そのうち使える数は ${available.ja} です。`,
      }),
    kind: KIND,
    keepersKinds: text({
      en: 'Adjustments, disposals and transfers between salons are recorded by owners and managers.',
      ja: '在庫の調整、廃棄、サロン間の移動は、オーナーとマネージャーが記録します。',
    }),
    direction: text({ en: 'Direction', ja: '向き' }),
    in: text({ en: 'Stock goes up', ja: '在庫が増える' }),
    out: text({ en: 'Stock goes down', ja: '在庫が減る' }),
    /** Which way a kind that moves either way goes */
    ways: {
      return: text({
        en: 'It goes down when returned to the supplier, and up when a customer brings it back.',
        ja: '仕入先に返すと減り、お客様から戻ると増えます。',
      }),
      transfer: text({
        en: 'It goes down when sent to another salon, and up when received from another salon. The salon that receives it records it as well.',
        ja: 'ほかのサロンへ送ると減り、ほかのサロンから受け取ると増えます。受け取ったサロンでも、記録します。',
      }),
      adjustment: text({
        en: 'Sets the stock on the books to the actual count.',
        ja: '帳簿の在庫数を、実際の数に合わせます。',
      }),
    },
    quantity: text({ en: 'Quantity', ja: '数量' }),
    decimals: text({
      en: 'Up to 2 decimal places.',
      ja: '小数は 2 桁まで。',
    }),
    /** The unit of the product stands as it was written */
    countedIn: (unit: string) =>
      text({
        en: `Counted in ${unit}. Up to 2 decimal places.`,
        ja: `${unit} で数えます。小数は 2 桁まで。`,
      }),
    unitCost: text({ en: 'Unit cost (yen)', ja: '単価（円）' }),
    unitCostDescription: text({
      en: 'Optional. The amount is the unit cost × the quantity, rounded to whole yen.',
      ja: '任意。金額は、単価 × 数量を四捨五入した円です。',
    }),
    reason: INVENTORY_WORDS.reason,
    reasonNeeded: text({
      en: 'Write why the stock changes, for the next person who counts it.',
      ja: '在庫数を変える理由を、次に数える人のために書きます。',
    }),
    optional: INVENTORY_WORDS.optional,
    record: INVENTORY_WORDS.record,
    cancel: INVENTORY_WORDS.cancel,
  },
  /** What is wrong with the values of the form */
  errors: {
    kind: text({ en: 'Choose the kind.', ja: '区分を選んでください。' }),
    direction: text({
      en: 'Choose whether the stock goes up or down.',
      ja: '在庫が増えるか、減るかを選んでください。',
    }),
    quantity: text({
      en: 'Enter the quantity as a number from 0.01 to 99,999,999.99 (up to 2 decimal places).',
      ja: '数量は、0.01 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
    }),
    /** The most that may be taken out: what is not reserved */
    atMost: (available: LocalizedText) =>
      text({
        en: `At most ${available.en} is available to take out.`,
        ja: `減らせるのは、使える数の ${available.ja} までです。`,
      }),
    aboveMost: text({
      en: 'Recording this would take the stock above 99,999,999.99. Check the quantity.',
      ja: '記録すると、在庫数が 99,999,999.99 を超えます。数量を確かめてください。',
    }),
    unitCost: text({
      en: 'Enter the unit cost as a whole number of yen, 0 or more.',
      ja: '単価は、0 以上の円の整数で入力してください。',
    }),
    cost: text({
      en: 'The amount (unit cost × quantity) is more than 2,147,483,647 yen. Check the unit cost and the quantity.',
      ja: '金額（単価 × 数量）が 2,147,483,647 円を超えます。単価と数量を確かめてください。',
    }),
    reason: text({
      en: 'For an adjustment and a disposal, enter the reason.',
      ja: '在庫の調整と廃棄では、理由を入力してください。',
    }),
    belowReserved: text({
      en: 'Recording this would take the stock below what is reserved: the stock changed meanwhile. Check the stock that was loaded again, and try again.',
      ja: '記録すると、在庫数が、引き当てた数を下回ります。その間に在庫数が変わりました。読み直した在庫数を確かめて、もう一度お試しください。',
    }),
  },
  forbidden: text({
    en: 'This account cannot record this stock movement. Only the owners and managers of the salon, and administrators, can record adjustments, disposals and transfers between salons.',
    ja: 'このアカウントでは、この在庫の移動を記録できません。在庫の調整、廃棄、サロン間の移動を記録できるのは、サロンのオーナーとマネージャーと、管理者です。',
  }),
  failed: FAILED,
  /** A movement that was recorded, and the stock it left */
  recorded: (kind: LocalizedText, balance: LocalizedText) =>
    text({
      en: `Recorded: ${kind.en}. The stock is now ${balance.en}.`,
      ja: `${kind.ja}を記録しました。在庫数は ${balance.ja} になりました。`,
    }),
  /** The history of the movements of a row */
  history: {
    /** The row and its stock, above the filter */
    about: (row: LocalizedText, current: LocalizedText) =>
      text({
        en: `${row.en}. In stock: ${current.en}.`,
        ja: `${row.ja}。在庫数は ${current.ja} です。`,
      }),
    loading: text({
      en: 'Loading the stock movements',
      ja: '在庫の移動を読み込んでいます',
    }),
    caption: TITLE,
    narrowedCaption: text({
      en: 'Stock movements matching the filters',
      ja: '条件に合う在庫の移動',
    }),
    noneMatch: text({
      en: 'No stock movements match these filters',
      ja: '条件に合う在庫の移動はありません',
    }),
    noneMatchDescription: LOOK_AGAIN,
    empty: text({ en: 'No stock movements', ja: '在庫の移動はありません' }),
    emptyDescription: text({
      en: 'Purchases, sales, use in treatments and the like appear here once they are recorded.',
      ja: '仕入れ、販売、施術での使用などを記録すると、ここに出ます。',
    }),
    record: INVENTORY_WORDS.recordMovement,
    toRow: text({ en: 'Back to the stock row', ja: '在庫の行へ' }),
  },
  /** The columns of the history */
  table: {
    moment: text({ en: 'Date and time', ja: '日時' }),
    kind: KIND,
    change: text({ en: 'Change', ja: '増減' }),
    balance: text({ en: 'Stock after', ja: '移動後の在庫数' }),
    cost: text({ en: 'Amount', ja: '金額' }),
    reason: INVENTORY_WORDS.reason,
    performer: text({ en: 'Recorded by', ja: '記録した人' }),
  },
  /** Which movements the history shows */
  filter: {
    label: text({
      en: 'Narrow the stock movements',
      ja: '在庫の移動を絞り込む',
    }),
    kind: KIND,
    all: INVENTORY_WORDS.all,
    from: text({ en: 'Recorded on (from)', ja: '記録した日（から）' }),
    to: text({ en: 'Recorded on (to)', ja: '記録した日（まで）' }),
  },
}
