import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { fieldMessages } from '../ui/fields'
import { followed, listed } from '../written'
import { type AmountLimits, limitsIn } from './sale-payments'

/*
 * What the screens of the payment methods say in the admin application:
 * the methods of a salon, a method shown, added, changed and removed, and
 * who may keep them. The display names of the methods, their descriptions
 * and the names of the companies that process their payments stand as
 * they were written.
 */

const TITLE = text({ en: 'Payment methods', ja: '支払い方法' })
const ENTRY = text({ en: 'Add a payment method', ja: '支払い方法を足す' })
const CHANGE = text({ en: 'Edit the payment method', ja: '支払い方法を直す' })

/** The words of the fields of a method, which the form, the record and the table say alike */
const WORDS = {
  method: text({ en: 'Payment method', ja: '支払い方法' }),
  kind: text({ en: 'Type', ja: '種類' }),
  displayName: text({ en: 'Display name', ja: '表示名' }),
  description: text({ en: 'Description', ja: '説明' }),
  amounts: text({ en: 'Amount at a time', ja: '1 回の金額' }),
  fee: text({ en: 'Fee rate', ja: '手数料率' }),
  processor: text({ en: 'Payment processor', ja: '決済代行会社' }),
  places: text({ en: 'Where used', ja: '使う場所' }),
  status: text({ en: 'Status', ja: '状態' }),
  sortOrder: text({ en: 'Sort order', ja: '並び順' }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  toMethods: text({
    en: 'Back to the payment methods',
    ja: '支払い方法へ',
  }),
}

/** The control that says whether the salon uses a method */
const IN_USE = text({
  en: 'Use this payment method',
  ja: 'この支払い方法を使う',
})

/** Who keeps the payment methods, said after what the account may not do */
const KEPT_BY = text({
  en: 'Only the owners and managers of the salon, and administrators, can change payment methods.',
  ja: '支払い方法を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
})

/** A method, as a sentence names it: 「支払い方法「現金」」 */
const methodNamed = (name: string): LocalizedText =>
  text({ en: `the payment method “${name}”`, ja: `支払い方法「${name}」` })

export const adminPaymentMethodMessages = {
  titles: {
    methods: TITLE,
    method: text({ en: 'Payment method details', ja: '支払い方法の内容' }),
    entry: ENTRY,
    change: CHANGE,
  },
  /** What a screen could not read, as it stands there */
  names: {
    methods: text({ en: 'the payment methods', ja: '支払い方法' }),
    method: text({ en: 'the payment method', ja: '支払い方法' }),
    /** What a member of another salon cannot see of this one */
    methodsOfTheSalon: text({ en: 'payment methods', ja: '支払い方法' }),
  },
  words: WORDS,
  loading: {
    methods: text({
      en: 'Loading the payment methods',
      ja: '支払い方法を読み込んでいます',
    }),
    method: text({
      en: 'Loading the payment method',
      ja: '支払い方法を読み込んでいます',
    }),
  },
  /** How a method is shown: what it takes at once, its fee, where and whether it is used */
  values: {
    /**
     * What a method takes at once, as a value stands alone: 「￥1,000から」,
     * "Up to ¥50,000", 「下限も上限もなし」.
     */
    amounts: (limits: AmountLimits | null): LocalizedText => {
      if (limits === null) {
        return text({ en: 'No limits', ja: '下限も上限もなし' })
      }
      const said = limitsIn(limits)

      return limits.least === null
        ? text({ en: `Up to ${limits.most.en}`, ja: said.ja })
        : said
    },
    noFee: text({ en: 'No fee', ja: '手数料なし' }),
    offline: text({ en: 'In store', ja: '店頭' }),
    online: text({ en: 'Online', ja: 'オンライン' }),
    /** Where a method is used: 「店頭、オンライン」, or that it is used in neither */
    placesOf: (places: readonly LocalizedText[]): LocalizedText =>
      places.length === 0
        ? text({ en: 'Neither', ja: 'どちらでも使わない' })
        : listed(places),
    inUse: text({ en: 'In use', ja: '使っている' }),
    notInUse: text({ en: 'Not in use', ja: '使っていない' }),
  },
  list: {
    description: text({
      en: 'The means chosen when a payment is recorded on the sales screens. A payment method that is not in use cannot be chosen for new payments.',
      ja: '売上の画面で支払いを記録するときに選ぶ手段です。使っていない支払い方法は、新しい支払いには選べません。',
    }),
    toSettings: text({ en: 'Back to the settings', ja: '設定へ' }),
    none: text({ en: 'No payment methods', ja: '支払い方法はありません' }),
  },
  form: {
    choose: text({ en: 'Choose', ja: '選んでください' }),
    kindDescription: text({
      en: 'It cannot be changed once added. Only credit and debit cards record the last four digits and the brand of the card.',
      ja: '足したあとは変えられません。カードの下 4 桁とブランドを記録できるのは、クレジットカードとデビットカードです。',
    }),
    /** The kind of a method that is changed, which stays */
    kindKept: (kind: LocalizedText) =>
      text({
        en: `Type: ${kind.en}. The type cannot be changed. If it is wrong, remove this payment method and add it again when no payment was received by it; otherwise stop using it and add a new one.`,
        ja: `種類: ${kind.ja}。種類は変えられません。間違えたときは、この支払い方法で受け取った支払いがなければ削除して足し直し、あれば使うのをやめて、新しく足してください。`,
      }),
    /** How long the name is, and where it is shown */
    displayNameDescription: (most: number) =>
      followed(
        fieldMessages.upTo(most),
        text({
          en: 'The name shown on the sales screens and the receipts.',
          ja: '売上の画面とレシートに出る名前です。',
        }),
      ),
    minimum: text({
      en: 'Smallest amount at a time (yen)',
      ja: '1 回の金額の下限（円）',
    }),
    minimumDescription: text({
      en: 'A whole number from 1. Leave it empty for no lower limit.',
      ja: '1 以上の整数。空にすると、下限はありません。',
    }),
    maximum: text({
      en: 'Largest amount at a time (yen)',
      ja: '1 回の金額の上限（円）',
    }),
    maximumDescription: text({
      en: 'A whole number no smaller than the smallest amount. Leave it empty for no upper limit.',
      ja: '下限と同じか、それより大きい整数。空にすると、上限はありません。',
    }),
    fee: text({ en: 'Fee rate (%)', ja: '手数料率（%）' }),
    feeDescription: text({
      en: 'From 0 to 100, with up to 2 decimal places. Enter 0 for no fee, or leave it empty not to record one.',
      ja: '0 から 100 まで、小数は 2 桁まで。手数料がなければ 0、記録しないときは空にします。',
    }),
    /** How long the name of the processor is, and when there is none */
    processorDescription: (most: number) =>
      followed(
        fieldMessages.upTo(most),
        text({
          en: 'Leave it empty when the payments do not go through a processor.',
          ja: '決済代行会社を介さないときは空にします。',
        }),
      ),
    offline: text({ en: 'Use for checkouts in store', ja: '店頭の会計で使う' }),
    online: text({
      en: 'Use for online payments',
      ja: 'オンラインの決済で使う',
    }),
    onlineDescription: text({
      en: 'Where it is used is kept as a record. The sales screens now offer every payment method in use, wherever it is used.',
      ja: '使う場所は記録として残ります。いまの売上の画面は、使っている支払い方法を、使う場所にかかわらず選べるようにします。',
    }),
    sortOrderDescription: text({
      en: 'A whole number from 0. Smaller numbers come first; methods may share a number.',
      ja: '0 以上の整数。小さいものから並びます。同じ数でもかまいません。',
    }),
    inUse: IN_USE,
    inUseDescription: text({
      en: 'Without it, the method cannot be chosen for new payments. The payments received by it stay recorded.',
      ja: '外すと、新しい支払いに使えなくなります。この支払い方法で受け取った支払いの記録は、そのまま残ります。',
    }),
    /** What the API refused, and what the form found wrong */
    errors: {
      kind: text({ en: 'Choose a type.', ja: '種類を選んでください。' }),
      /** What a sentence about the name of the processor names */
      processorName: text({
        en: 'Name of the payment processor',
        ja: '決済代行会社の名前',
      }),
      fee: text({
        en: 'Enter the fee rate as a number from 0 to 100, with up to 2 decimal places.',
        ja: '手数料率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
      }),
      minimum: text({
        en: 'Enter the smallest amount as a whole number of yen from 1.',
        ja: '下限は、1 以上の円の整数で入力してください。',
      }),
      maximum: text({
        en: 'Enter the largest amount as a whole number of yen from 1.',
        ja: '上限は、1 以上の円の整数で入力してください。',
      }),
      /** The largest amount is smaller than the smallest */
      range: text({
        en: 'Make the largest amount the same as the smallest amount or larger.',
        ja: '上限は、下限と同じか、下限より大きい金額にしてください。',
      }),
      /** The smallest amount is larger than the largest the API keeps: that was changed meanwhile */
      rangeFromBelow: text({
        en: 'Make the smallest amount the same as the largest amount or smaller.',
        ja: '下限は、上限と同じか、上限より小さい金額にしてください。',
      }),
      sortOrder: text({
        en: 'Enter the sort order as a whole number from 0.',
        ja: '並び順は、0 以上の整数で入力してください。',
      }),
    },
    /** The account may not keep the payment methods of the salon */
    forbidden: text({
      en: 'The payment methods of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its payment methods.',
      ja: 'このサロンの支払い方法は、変えられません。支払い方法を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    }),
    failed: text({
      en: 'Could not save the payment method. Check your connection and try again.',
      ja: '支払い方法を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  entry: {
    submit: text({ en: 'Add', ja: '足す' }),
    added: (name: string) =>
      text({
        en: `Added ${methodNamed(name).en}.`,
        ja: `${methodNamed(name).ja}を足しました。`,
      }),
  },
  change: {
    submit: text({ en: 'Save changes', ja: '変更を保存する' }),
    changed: (name: string) =>
      text({
        en: `Saved ${methodNamed(name).en}.`,
        ja: `${methodNamed(name).ja}を直しました。`,
      }),
  },
  removal: {
    remove: text({ en: 'Remove', ja: '削除' }),
    title: (name: string) =>
      text({
        en: `Remove ${methodNamed(name).en}?`,
        ja: `${methodNamed(name).ja}を削除しますか？`,
      }),
    description: text({
      en: 'It can no longer be chosen on the sales screens. A payment method that payments were received by cannot be removed: stop using it instead. A removed payment method cannot be restored.',
      ja: '売上の画面で選べなくなります。この支払い方法で受け取った支払いがあれば、削除できません。そのときは、使うのをやめてください。削除した支払い方法は、元に戻せません。',
    }),
    back: uiMessages.back,
    submit: text({ en: 'Remove', ja: '削除する' }),
    done: (name: string) =>
      text({
        en: `Removed ${methodNamed(name).en}.`,
        ja: `${methodNamed(name).ja}を削除しました。`,
      }),
    /** Payments were received by the method: the salon stops using it instead */
    inUse: (name: string) =>
      text({
        en: `Payments were received by ${methodNamed(name).en}, so it cannot be removed. To stop using it, clear “${IN_USE.en}” and save.`,
        ja: `${methodNamed(name).ja}で受け取った支払いがあるので、削除できません。使うのをやめるときは、「${IN_USE.ja}」の印を外して保存してください。`,
      }),
    failed: text({
      en: 'Could not remove the payment method. Check your connection and try again.',
      ja: '支払い方法を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** What a screen for the keepers of the payment methods says to an account that does not keep them */
  keepers: {
    forbidden: followed(
      text({
        en: 'This account cannot change the payment methods.',
        ja: 'このアカウントでは、支払い方法を変えられません。',
      }),
      KEPT_BY,
    ),
    back: text({
      en: 'Back to the payment methods',
      ja: '支払い方法へ戻る',
    }),
  },
  /** A screen of a payment method when there is none to show */
  notFound: {
    title: text({
      en: 'Payment method not found',
      ja: '支払い方法が見つかりません',
    }),
    description: text({
      en: 'Check that the address is right. A removed payment method cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。削除した支払い方法は、表示できません。',
    }),
  },
}
