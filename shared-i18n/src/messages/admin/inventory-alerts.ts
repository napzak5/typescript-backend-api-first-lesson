import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { countOf } from '../written'
import { INVENTORY_WORDS, LOOK_AGAIN } from './inventory-words'

/*
 * The alerts of the stock: their kinds and severities, how many there
 * are, the list with its filter, and the dialog that acknowledges one with
 * what it says after. An alert is named by its kind and by what it is of:
 * a product or a stock row, whose names stand as they were written.
 */

const TITLE = text({ en: 'Inventory alerts', ja: '在庫のアラート' })
const SEVERITY = text({ en: 'Severity', ja: '重要度' })
const ACKNOWLEDGEMENT = text({ en: 'Acknowledgement', ja: '確認' })
const ACKNOWLEDGE = text({ en: 'Acknowledge', ja: '確認済みにする' })
const NOT_ACKNOWLEDGED = text({ en: 'Not acknowledged', ja: '未確認' })

/** An alert inside a sentence, by its kind and what it is of: 「Hair Color（COLOR001）の在庫僅少」 */
const alertOf = (kind: LocalizedText, subject: LocalizedText): LocalizedText =>
  text({
    en: `the alert “${kind.en}” for ${subject.en}`,
    ja: `${subject.ja}の${kind.ja}`,
  })

/** How many alerts: 「3 件」, "3 alerts" */
const alertsOf = (count: number): LocalizedText =>
  countOf(count, 'alert', 'alerts', '件')

export const inventoryAlertMessages = {
  title: TITLE,
  /** The kinds of an alert, by the values of the API */
  kinds: {
    low_stock: text({ en: 'Low stock', ja: '在庫僅少' }),
    overstock: text({ en: 'Overstock', ja: '在庫過剰' }),
    expiring: text({ en: 'Expiring soon', ja: '期限切れ間近' }),
    expired: INVENTORY_WORDS.expired,
  },
  /** The severities of an alert, by the values of the API */
  severities: {
    critical: text({ en: 'Critical', ja: '緊急' }),
    warning: text({ en: 'Warning', ja: '注意' }),
    info: text({ en: 'Info', ja: '情報' }),
  },
  /** What the stock of a product is held against: the minimum for low stock, the maximum for overstock */
  minimum: text({ en: 'Minimum stock', ja: '最低在庫数' }),
  maximum: text({ en: 'Maximum stock', ja: '最大在庫数' }),
  notAcknowledged: NOT_ACKNOWLEDGED,
  acknowledged: text({ en: 'Acknowledged', ja: '確認済み' }),
  /** How the alerts are worked out, above them */
  about: text({
    en: 'Low stock and overstock are raised by comparing the stock of a product, all its stock rows together, with its minimum and maximum stock. Expiring soon (within 30 days of the expiry date) and expired are raised for each stock row.',
    ja: '在庫僅少と在庫過剰は、商品のすべての在庫の行を合わせた在庫数を、最低在庫数と最大在庫数に比べて出ます。期限切れ間近（使用期限まで 30 日以内）と期限切れは、在庫の行ごとに出ます。',
  }),
  /** How many alerts there are now */
  summary: {
    loading: text({
      en: 'Loading the number of alerts',
      ja: 'アラートの件数を読み込んでいます',
    }),
    none: text({
      en: 'No alerts are raised now.',
      ja: '今出ているアラートはありません。',
    }),
    allAcknowledged: (total: number) =>
      text({
        en: `Alerts raised now: ${numberOf(total).en}, all of them acknowledged.`,
        ja: `今出ているアラートは ${alertsOf(total).ja}で、どれも確認済みです。`,
      }),
    someNotAcknowledged: (total: number, unacknowledged: number) =>
      text({
        en: `Alerts raised now: ${numberOf(total).en}, of which ${numberOf(unacknowledged).en} not acknowledged.`,
        ja: `今出ているアラートは ${alertsOf(total).ja}で、そのうち ${alertsOf(unacknowledged).ja}が未確認です。`,
      }),
    alertsOf,
  },
  /** The list of the alerts */
  list: {
    loading: text({
      en: 'Loading the inventory alerts',
      ja: '在庫のアラートを読み込んでいます',
    }),
    caption: TITLE,
    narrowedCaption: text({
      en: 'Inventory alerts matching the filters',
      ja: '条件に合う在庫のアラート',
    }),
    noneMatch: text({
      en: 'No inventory alerts match these filters',
      ja: '条件に合う在庫のアラートはありません',
    }),
    noneMatchDescription: LOOK_AGAIN,
    empty: text({
      en: 'No inventory alerts',
      ja: '在庫のアラートはありません',
    }),
    emptyDescription: text({
      en: 'Products whose stock is at their minimum or below, or above their maximum, and stock rows whose expiry date is near or past appear here.',
      ja: '在庫数が最低在庫数以下か最大在庫数より多くなった商品と、使用期限が近いか過ぎた在庫の行が、ここに出ます。',
    }),
    toInventory: INVENTORY_WORDS.toInventory,
  },
  /** The columns of the list */
  table: {
    alert: text({ en: 'Alert', ja: 'アラート' }),
    subject: text({ en: 'Subject', ja: '対象' }),
    inStock: INVENTORY_WORDS.inStock,
    acknowledgement: ACKNOWLEDGEMENT,
    /** The expiry of the stock row of an alert */
    expiryOf: (expiry: LocalizedText) =>
      text({ en: `Expiry: ${expiry.en}`, ja: `使用期限 ${expiry.ja}` }),
    /** What the stock of a product is held against */
    thresholdOf: (term: LocalizedText, quantity: LocalizedText) =>
      text({
        en: `${term.en}: ${quantity.en}`,
        ja: `${term.ja} ${quantity.ja}`,
      }),
    acknowledge: ACKNOWLEDGE,
    acknowledgeLabel: (kind: LocalizedText, subject: LocalizedText) => {
      const alert = alertOf(kind, subject)

      return text({
        en: `Acknowledge ${alert.en}`,
        ja: `${alert.ja}を確認済みにする`,
      })
    },
  },
  /** Which alerts the list shows */
  filter: {
    label: text({
      en: 'Narrow the inventory alerts',
      ja: '在庫のアラートを絞り込む',
    }),
    kind: text({ en: 'Kind', ja: '種類' }),
    severity: SEVERITY,
    acknowledgement: ACKNOWLEDGEMENT,
    all: INVENTORY_WORDS.all,
  },
  /** The dialog that acknowledges an alert */
  dialog: {
    title: (kind: LocalizedText, subject: LocalizedText) => {
      const alert = alertOf(kind, subject)

      return text({
        en: `Acknowledge ${alert.en}?`,
        ja: `${alert.ja}を確認済みにしますか？`,
      })
    },
    description: text({
      en: 'Tells the other staff that you saw the alert and acted on it. When the stock moves or the minimum or maximum stock of the product changes, and the alert changes with it, the alert goes back to not acknowledged.',
      ja: 'アラートを見て手を打ったことを、ほかのスタッフに伝えます。在庫が動くか、商品の最低在庫数や最大在庫数が変わって、アラートの状態が変わると、もう一度未確認になります。',
    }),
    submit: ACKNOWLEDGE,
    severity: SEVERITY,
    inStock: INVENTORY_WORDS.inStock,
    expiry: INVENTORY_WORDS.expiry,
    notes: INVENTORY_WORDS.notes,
    notesDescription: text({
      en: 'Optional. What you did, or what you will do (ordered more, will dispose of it, and so on).',
      ja: '任意。何をしたか、これから何をするかを書きます（発注した、廃棄する、など）。',
    }),
  },
  /** What follows an attempt to acknowledge an alert */
  done: (kind: LocalizedText, subject: LocalizedText) => {
    const alert = alertOf(kind, subject)

    return text({
      en: `Acknowledged ${alert.en}.`,
      ja: `${alert.ja}を確認済みにしました。`,
    })
  },
  gone: (kind: LocalizedText, subject: LocalizedText) =>
    text({
      en: `The alert “${kind.en}” for ${subject.en} is no longer raised. Meanwhile the stock moved or the product changed. The alerts were loaded again.`,
      ja: `${alertOf(kind, subject).ja}は、もう出ていません。その間に、在庫が動いたか、商品が変わりました。アラートを読み直しました。`,
    }),
  acknowledgedMeanwhile: (kind: LocalizedText, subject: LocalizedText) =>
    text({
      en: `Someone else acknowledged ${alertOf(kind, subject).en} meanwhile. The alerts were loaded again.`,
      ja: `${alertOf(kind, subject).ja}は、その間に、ほかの人が確認済みにしました。アラートを読み直しました。`,
    }),
  forbidden: text({
    en: 'This account cannot acknowledge the alerts of this salon.',
    ja: 'このアカウントでは、このサロンのアラートを確認済みにできません。',
  }),
  failed: text({
    en: 'The alert could not be acknowledged. Check your connection and try again.',
    ja: 'アラートを確認済みにできませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
}
