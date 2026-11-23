import { numberOf } from '../../formats/numbers'
import { text } from '../../languages/localized-text'
import { countedIn } from '../written'
import { MENU_WORDS } from './menu-words'

/*
 * What the form that gives several services of the menu the same values
 * says: which services, which of their values, what is wrong with the
 * form, and what the API refused. A control left at 「変えない」 sends
 * nothing. The names of the services and the categories stand as they
 * were written.
 */

export const menuBulkMessages = {
  title: text({
    en: 'Change several services at once',
    ja: 'サービスをまとめて変える',
  }),
  /** The way to the form, from the menu */
  open: text({ en: 'Change several at once', ja: 'まとめて変える' }),
  services: text({ en: 'Services', ja: 'サービス' }),
  chosen: text({ en: 'Services to change', ja: '変えるサービス' }),
  /** The order the services are offered in, and how many may be chosen */
  chosenDescription: (most: number) =>
    text({
      en: `In the order of the menu, each with its category. 1 to ${numberOf(most).en}.`,
      ja: `メニューの順。名前のあとは、カテゴリーです。1 件から ${numberOf(most).ja} 件まで。`,
    }),
  values: text({ en: 'Values to change', ja: '変える項目' }),
  valuesDescription: text({
    en: 'Every chosen service is given the same value. A value left at “Keep” stays as it is for each service.',
    ja: '選んだサービスのすべてを、同じ値にします。「変えない」のままの項目は、サービスごとに今のままです。',
  }),
  keep: text({ en: 'Keep', ja: '変えない' }),
  category: MENU_WORDS.category,
  uncategorize: text({ en: 'Make uncategorized', ja: '未分類にする' }),
  active: MENU_WORDS.active,
  switchOn: text({ en: 'Make active', ja: '有効にする' }),
  switchOff: text({ en: 'Make inactive', ja: '無効にする' }),
  onlineBooking: MENU_WORDS.onlineBooking,
  accepted: MENU_WORDS.accepted,
  notAccepted: MENU_WORDS.notAccepted,
  status: text({ en: 'Offering status', ja: '提供の状態' }),
  availability: MENU_WORDS.availability,
  staffLevel: MENU_WORDS.staffLevel,
  everyMember: MENU_WORDS.everyMember,
  change: text({ en: 'Change', ja: '変える' }),
  /** What is wrong with the form, and what the API refused */
  errors: {
    services: text({
      en: 'Choose at least one service to change.',
      ja: '変えるサービスを、1 件以上選んでください。',
    }),
    tooManyServices: (most: number) =>
      text({
        en: `Up to ${numberOf(most).en} services can be changed at once.`,
        ja: `一度に変えられるサービスは、${numberOf(most).ja} 件までです。`,
      }),
    nothingToChange: text({
      en: 'Choose at least one value to change. Left at “Keep”, nothing changes.',
      ja: '変える項目を、1 つ以上選んでください。「変えない」のままでは、何も変わりません。',
    }),
    servicesGone: text({
      en: 'One of the chosen services was removed from the menu meanwhile. No service was changed. Choose again from the menu as it is now.',
      ja: '選んだサービスのどれかが、その間にメニューから削除されていました。どのサービスも変えていません。いまのメニューから、選び直してください。',
    }),
  },
  failed: text({
    en: 'The services could not be changed. Check your connection and try again.',
    ja: 'サービスを変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
  /** What is said once the services were changed: 「3 件のサービスを変えました。」 */
  changed: (count: number) =>
    text({
      en: `Changed ${countedIn(count, 'service', 'services')}.`,
      ja: `${numberOf(count).ja} 件のサービスを変えました。`,
    }),
}
