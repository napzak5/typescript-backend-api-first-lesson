import { numberOf } from '../../formats/numbers'
import { text } from '../../languages/localized-text'
import { fieldMessages } from '../ui/fields'
import { followed } from '../written'
import { MENU_WORDS } from './menu-words'

/*
 * What the form of a service of the menu says: its parts and controls,
 * the rows of the services of a package and of the options, and what is
 * wrong with the values or what the API refused of them. The names of the
 * services and the options stand as they were written.
 */

/** The fewest and the most services of a package, as a sentence says them */
const packagedRange = (fewest: number, most: number) =>
  text({
    en: `${numberOf(fewest).en} to ${numberOf(most).en}`,
    ja: `${numberOf(fewest).ja} 件から ${numberOf(most).ja} 件`,
  })

export const menuServiceFormMessages = {
  /** The parts of the form */
  parts: {
    service: MENU_WORDS.service,
    timeAndPrice: text({ en: 'Time and price', ja: '時間と料金' }),
    offering: text({ en: 'Offering', ja: '提供' }),
    booking: text({ en: 'Booking', ja: '予約' }),
    photos: text({ en: 'Photos', ja: '写真' }),
    package: text({ en: 'Package', ja: 'パッケージ' }),
    options: text({ en: 'Options', ja: 'オプション' }),
    optionsDescription: text({
      en: 'What the customers can add when they book. They are offered in this order.',
      ja: 'お客様が予約のときに足せるものです。並びの順に、お客様に出ます。',
    }),
  },
  name: MENU_WORDS.name,
  /** How long the name may be, and where it is shown */
  nameDescription: (most: number) =>
    followed(
      fieldMessages.upTo(most),
      text({
        en: 'It appears on the menu the customers see.',
        ja: 'お客様のメニューに出ます。',
      }),
    ),
  category: MENU_WORDS.category,
  uncategorized: MENU_WORDS.uncategorized,
  shortDescription: text({ en: 'Short description', ja: '短い紹介' }),
  /** How long the short description may be, and where it is shown */
  shortDescriptionDescription: (most: number) =>
    followed(
      fieldMessages.upTo(most),
      text({
        en: 'It appears in the list of the menu.',
        ja: 'メニューの一覧に出ます。',
      }),
    ),
  description: MENU_WORDS.description,
  tags: text({ en: 'Tags', ja: 'タグ' }),
  tagsDescription: text({
    en: 'Separate them with “,” or “、”.',
    ja: '「、」か「,」で区切って書きます。',
  }),
  displayOrder: MENU_WORDS.displayOrder,
  displayOrderDescription: MENU_WORDS.displayOrderDescription,
  duration: text({ en: 'Duration (minutes)', ja: '所要時間（分）' }),
  /** The longest a service may take, in minutes */
  durationDescription: (most: number) =>
    text({
      en: `A whole number from 1 to ${numberOf(most).en}.`,
      ja: `1 から ${numberOf(most).ja} までの整数。`,
    }),
  pricing: MENU_WORDS.pricing,
  price: MENU_WORDS.price,
  priceDescription: text({
    en: 'A whole number of 0 or more.',
    ja: '0 以上の整数。',
  }),
  discountPrice: text({ en: 'Discounted price', ja: '割引後の料金' }),
  discountPriceDescription: text({
    en: 'A whole number no higher than the price. Leave it empty when there is no discount.',
    ja: '料金以下の整数。割引がなければ、空のままにします。',
  }),
  taxIncluded: text({ en: 'Tax included', ja: '税込' }),
  taxIncludedDescription: text({
    en: 'When cleared, the price is before tax.',
    ja: '外すと、料金は税別です。',
  }),
  active: MENU_WORDS.active,
  activeDescription: text({
    en: 'When cleared, the service no longer appears on the menu the customers see, and cannot be booked.',
    ja: '外すと、お客様のメニューに出なくなり、予約できなくなります。',
  }),
  status: text({ en: 'Offering status', ja: '提供の状態' }),
  statusDescription: text({
    en: 'Customers can book the services whose status is “Active”.',
    ja: 'お客様が予約できるのは、「有効」のサービスです。',
  }),
  availability: MENU_WORDS.availability,
  onlineBooking: text({
    en: 'Accept online bookings',
    ja: 'オンライン予約を受ける',
  }),
  onlineBookingDescription: text({
    en: 'When cleared, the customers can no longer book it themselves. The salon can still put in bookings of it.',
    ja: '外すと、お客様が自分で予約できなくなります。サロンが入れる予約には使えます。',
  }),
  consultation: text({
    en: 'Needs a consultation',
    ja: 'カウンセリングが要る',
  }),
  staffLevel: MENU_WORDS.staffLevel,
  everyMember: MENU_WORDS.everyMember,
  mostBookings: text({ en: 'Most bookings a day', ja: '1 日の予約の上限' }),
  mostBookingsDescription: text({
    en: 'A whole number of 1 or more. Leave it empty when there is no limit.',
    ja: '1 以上の整数。上限がなければ、空のままにします。',
  }),
  requirements: text({ en: 'Booking requirements', ja: '予約の条件' }),
  photo: text({ en: 'Photo URL', ja: '写真の URL' }),
  otherPhotos: text({ en: 'Other photo URLs', ja: 'ほかの写真の URL' }),
  otherPhotosDescription: text({
    en: 'One per line. URLs that begin with http:// or https://.',
    ja: '1 行に 1 つ。http:// か https:// で始まる URL。',
  }),
  /** A service in a package cannot be one: the packages it is in, by name */
  inPackages: (packages: readonly string[]) =>
    text({
      en: `This service is in the package${packages.length === 1 ? '' : 's'} ${packages.map((name) => `“${name}”`).join(', ')}, so it cannot be a package.`,
      ja: `このサービスは、パッケージ${packages.map((name) => `「${name}」`).join('')}に入っているので、パッケージにできません。`,
    }),
  makePackage: text({ en: 'Make it a package', ja: 'パッケージにする' }),
  /** How many services a package is made of, and which */
  makePackageDescription: (fewest: number, most: number) =>
    text({
      en: `Puts ${packagedRange(fewest, most).en} other services together as one service. Only services that are not packages can be put in a package.`,
      ja: `ほかのサービスを ${packagedRange(fewest, most).ja}まとめて、1 つのサービスにします。パッケージに入れられるのは、パッケージでないサービスです。`,
    }),
  /** A row of the services of a package, counted from 1 */
  packaged: (row: number) =>
    text({
      en: `Packaged service ${numberOf(row).en}`,
      ja: `構成サービス ${numberOf(row).ja}`,
    }),
  packagedService: MENU_WORDS.service,
  choose: MENU_WORDS.choose,
  removePackaged: (row: number) =>
    text({
      en: `Remove packaged service ${numberOf(row).en}`,
      ja: `構成サービス ${numberOf(row).ja} を外す`,
    }),
  removeRow: text({ en: 'Remove', ja: '外す' }),
  addPackaged: text({ en: 'Add a packaged service', ja: '構成サービスを足す' }),
  /** A row of an option, counted from 1 */
  option: (row: number) =>
    text({
      en: `Option ${numberOf(row).en}`,
      ja: `オプション ${numberOf(row).ja}`,
    }),
  optionType: MENU_WORDS.type,
  maxQuantity: text({ en: 'Most to choose', ja: '選べる数' }),
  additionalTime: text({
    en: 'Extra time (minutes)',
    ja: '追加の時間（分）',
  }),
  additionalPrice: text({ en: 'Extra price', ja: '追加の料金' }),
  required: text({ en: 'Required', ja: '必須' }),
  requiredDescription: text({
    en: 'It is always added to the booking.',
    ja: '予約のときに、かならず付きます。',
  }),
  removeOption: (row: number) =>
    text({
      en: `Remove option ${numberOf(row).en}`,
      ja: `オプション ${numberOf(row).ja} を外す`,
    }),
  addOption: text({ en: 'Add an option', ja: 'オプションを足す' }),
  /** What is wrong with the values of the form, and what the API refused */
  errors: {
    /** The name of a service, as a sentence names it */
    name: text({ en: 'Service name', ja: 'サービスの名前' }),
    shortDescription: text({ en: 'Short description', ja: '短い紹介' }),
    duration: (most: number) =>
      text({
        en: `Enter the duration as a whole number of minutes from 1 to ${numberOf(most).en}.`,
        ja: `所要時間は、1 から ${numberOf(most).ja} までの整数（分）で入力してください。`,
      }),
    price: text({
      en: 'Enter the price as a whole number of 0 or more.',
      ja: '料金は、0 以上の整数で入力してください。',
    }),
    discountPrice: text({
      en: 'Enter the discounted price as a whole number of 0 or more. Leave it empty when there is no discount.',
      ja: '割引後の料金は、0 以上の整数で入力してください。割引がなければ、空のままにします。',
    }),
    discountAbovePrice: text({
      en: 'The discounted price can be at most the price.',
      ja: '割引後の料金は、料金以下にしてください。',
    }),
    pricing: text({
      en: 'Choose how the price is decided.',
      ja: '価格の決め方を選んでください。',
    }),
    displayOrder: MENU_WORDS.displayOrderError,
    status: text({
      en: 'Choose the offering status.',
      ja: '提供の状態を選んでください。',
    }),
    availability: text({
      en: 'Choose the availability.',
      ja: '提供日を選んでください。',
    }),
    mostBookings: text({
      en: 'Enter the most bookings a day as a whole number of 1 or more. Leave it empty when there is no limit.',
      ja: '1 日の予約の上限は、1 以上の整数で入力してください。上限がなければ、空のままにします。',
    }),
    /** How many services a package is made of */
    packagedCount: (fewest: number, most: number) =>
      text({
        en: `Choose ${packagedRange(fewest, most).en} packaged services for a package.`,
        ja: `パッケージにするときは、構成サービスを ${packagedRange(fewest, most).ja}まで選んでください。`,
      }),
    packagedMissing: text({
      en: 'Choose a service.',
      ja: 'サービスを選んでください。',
    }),
    packagedTwice: text({
      en: 'A service can be put in only once.',
      ja: '同じサービスは、1 回だけ入れられます。',
    }),
    /** The name of an option, as a sentence names it */
    optionName: text({ en: 'Option name', ja: 'オプションの名前' }),
    optionType: text({
      en: 'Choose the type of the option.',
      ja: 'オプションの種類を選んでください。',
    }),
    additionalTime: text({
      en: 'Enter the extra time as a whole number of minutes, 0 or more.',
      ja: '追加の時間は、0 以上の整数（分）で入力してください。',
    }),
    additionalPrice: text({
      en: 'Enter the extra price as a whole number of 0 or more.',
      ja: '追加の料金は、0 以上の整数で入力してください。',
    }),
    maxQuantity: text({
      en: 'Enter the most to choose as a whole number of 1 or more.',
      ja: '選べる数は、1 以上の整数で入力してください。',
    }),
    /**
     * The API found the discounted price above the price: the form checks
     * the two it sends, so one of them was changed meanwhile
     */
    pricesChanged: text({
      en: 'The price or the discounted price was changed meanwhile, and the discounted price would be above the price. Check the prices on the page of the service.',
      ja: 'その間に、料金か割引後の料金が変わっていて、割引後の料金が料金を上回ります。サービスの画面で、いまの料金を確かめてください。',
    }),
    /** The category that was chosen was removed meanwhile */
    categoryGone: text({
      en: 'This category was removed meanwhile. Choose the category again.',
      ja: 'このカテゴリーは、その間に削除されていました。カテゴリーを選び直してください。',
    }),
    /** A service of the package cannot be one now */
    packagedGone: text({
      en: 'One of the packaged services was removed or made a package meanwhile. Choose again.',
      ja: '構成サービスのどれかが、その間に削除されたか、パッケージになっていました。選び直してください。',
    }),
    /** The service became one of the services of a package meanwhile */
    contained: text({
      en: 'A service that is in another package cannot be a package.',
      ja: '別のパッケージに入っているサービスは、パッケージにできません。',
    }),
  },
  /** The failure of a write, by the write */
  failed: {
    entry: text({
      en: 'The service could not be added. Check your connection and try again.',
      ja: 'サービスを足せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    change: text({
      en: 'The service could not be saved. Check your connection and try again.',
      ja: 'サービスを直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
}
