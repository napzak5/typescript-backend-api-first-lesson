import { type LocalizedText, text } from '../../languages/localized-text'
import { countOf } from '../written'
import { MENU_WORDS } from './menu-words'

/*
 * What the screens of the services of the menu say: the menu in its parts,
 * a service shown, the price of one in a line, a service written and
 * removed, and why one in use stays. The names of the services, the
 * categories and the options, the descriptions, the tags and the
 * addresses of the photos stand as they were written.
 */

export const menuServiceMessages = {
  /** The services of a category, or of none */
  sections: {
    service: MENU_WORDS.service,
    duration: MENU_WORDS.duration,
    price: MENU_WORDS.price,
    onlineBooking: MENU_WORDS.onlineBooking,
    status: MENU_WORDS.status,
    empty: text({
      en: 'No services in this category',
      ja: 'このカテゴリーのサービスはありません',
    }),
  },
  /** The price of a service in a line, as the menu of the customers reads it */
  price: {
    /** A price after a discount, with the price before it: 「¥7,200（¥8,000 から割引）」 */
    discounted: (discount: LocalizedText, price: LocalizedText) =>
      text({
        en: `${discount.en} (discounted from ${price.en})`,
        ja: `${discount.ja}（${price.ja} から割引）`,
      }),
    taxIncluded: text({ en: 'Tax included', ja: '税込' }),
    taxExcluded: text({ en: 'Before tax', ja: '税別' }),
  },
  /** A service as the form of a change of several services offers it, with its category: 「Cut（Hair）」 */
  choiceOf: (name: string, category: LocalizedText) =>
    text({ en: `${name} (${category.en})`, ja: `${name}（${category.ja}）` }),
  /** What the menu keeps of a service */
  record: {
    service: MENU_WORDS.service,
    name: MENU_WORDS.name,
    category: MENU_WORDS.category,
    status: MENU_WORDS.status,
    duration: MENU_WORDS.duration,
    price: MENU_WORDS.price,
    pricing: MENU_WORDS.pricing,
    availability: MENU_WORDS.availability,
    displayOrder: MENU_WORDS.displayOrder,
    shortDescription: text({ en: 'Short description', ja: '短い紹介' }),
    description: MENU_WORDS.description,
    tags: text({ en: 'Tags', ja: 'タグ' }),
    photo: text({ en: 'Photo URL', ja: '写真の URL' }),
    otherPhotos: text({ en: 'Other photo URLs', ja: 'ほかの写真の URL' }),
    booking: text({ en: 'Booking', ja: '予約' }),
    onlineBooking: MENU_WORDS.onlineBooking,
    requirements: text({ en: 'Booking requirements', ja: '予約の条件' }),
    consultation: text({ en: 'Consultation', ja: 'カウンセリング' }),
    needed: text({ en: 'Needed', ja: '必要' }),
    notNeeded: text({ en: 'Not needed', ja: '不要' }),
    staffLevel: MENU_WORDS.staffLevel,
    anybody: text({ en: 'Anybody', ja: 'だれでも' }),
    mostBookings: text({ en: 'Most bookings a day', ja: '1 日の予約の上限' }),
    noLimit: text({ en: 'No limit', ja: '上限なし' }),
    /** How many bookings a day a service takes at most: 「3 件」 */
    bookingsOf: (count: number) => countOf(count, 'booking', 'bookings', '件'),
    packaged: text({
      en: 'Services of the package',
      ja: 'パッケージのサービス',
    }),
    /** A service of a package that is not on the menu any more */
    unlisted: text({
      en: 'Service not on the menu',
      ja: 'メニューにないサービス',
    }),
    options: text({ en: 'Options', ja: 'オプション' }),
    optionType: MENU_WORDS.type,
    additionalTime: text({ en: 'Extra time', ja: '追加の時間' }),
    additionalPrice: text({ en: 'Extra price', ja: '追加の料金' }),
    maxQuantity: text({ en: 'Most to choose', ja: '選べる数' }),
    required: text({ en: 'Required', ja: '必須' }),
    optional: text({ en: 'Optional', ja: '任意' }),
    noOptions: text({ en: 'No options', ja: 'オプションはありません' }),
  },
  /** What follows a service that was written */
  added: (name: string) =>
    text({
      en: `Added the service “${name}” to the menu.`,
      ja: `サービス「${name}」を、メニューに足しました。`,
    }),
  changed: (name: string) =>
    text({
      en: `Saved the service “${name}”.`,
      ja: `サービス「${name}」を直しました。`,
    }),
  /** The removal of a service */
  removal: {
    confirm: (name: string) =>
      text({
        en: `Remove the service “${name}”?`,
        ja: `サービス「${name}」を削除しますか？`,
      }),
    description: text({
      en: 'It leaves the menu, and neither the customers nor the salon can book it any more. The lines of the bookings that have it stay as they are. A removed service cannot be brought back.',
      ja: 'メニューから消え、お客様もサロンも、このサービスで予約を入れられなくなります。すでにある予約の施術明細は、そのまま残ります。削除したサービスは、元に戻せません。',
    }),
    done: (name: string) =>
      text({
        en: `Removed the service “${name}” from the menu.`,
        ja: `サービス「${name}」を、メニューから削除しました。`,
      }),
    failed: text({
      en: 'The service could not be removed. Check your connection and try again.',
      ja: 'サービスを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    /**
     * Why a service in use stays, and what to do first: the packages it is
     * one of the services of, by name, or else the bookings not over yet
     * that have a line of it
     */
    inUse: (name: string, packages: readonly string[]) =>
      packages.length === 0
        ? text({
            en: `The service “${name}” is on the lines of bookings that are not finished, so it cannot be removed. Finish or cancel those bookings, or take the lines off them, then remove it.`,
            ja: `サービス「${name}」は、終わっていない予約の施術明細にあるので、削除できません。その予約を終えるか、キャンセルするか、明細を外してから削除してください。`,
          })
        : text({
            en: `The service “${name}” is in the package${packages.length === 1 ? '' : 's'} ${packages.map((one) => `“${one}”`).join(', ')}, so it cannot be removed. Take it out of the packaged services first.`,
            ja: `サービス「${name}」は、パッケージ${packages.map((one) => `「${one}」`).join('')}に入っているので、削除できません。先に、パッケージの構成サービスから外してください。`,
          }),
  },
  /** The screens of a service */
  loading: text({
    en: 'Loading the service',
    ja: 'サービスを読み込んでいます',
  }),
  change: text({ en: 'Edit the service', ja: 'サービスを直す' }),
  notFound: {
    title: text({ en: 'Service not found', ja: 'サービスが見つかりません' }),
    description: text({
      en: 'Check that the address is right. A service removed from the menu cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。メニューから削除したサービスは、表示できません。',
    }),
  },
}
