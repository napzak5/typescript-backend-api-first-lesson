import { type LocalizedText, text } from '../../languages/localized-text'
import { fieldMessages } from '../ui/fields'
import { followed } from '../written'
import { SALON_WORDS } from './settings-words'

/*
 * The form of the information of a salon, which registers one and changes
 * one, and what it says after the API took it or not.
 */

export const salonForm = {
  form: {
    /** What a sentence about the name of the salon names */
    salonName: text({ en: 'Salon name', ja: 'サロンの名前' }),
    nameDescription: (most: number) =>
      followed(
        fieldMessages.upTo(most),
        text({
          en: 'Shown when customers look for a salon.',
          ja: 'お客様がサロンを探すときに出ます。',
        }),
      ),
    descriptionDescription: text({
      en: 'Shown in the details of the salon.',
      ja: 'サロンの詳細に出ます。',
    }),
    accepting: text({
      en: 'Accept online bookings',
      ja: 'オンライン予約を受け付ける',
    }),
    acceptingDescription: text({
      en: 'Without it, customers cannot see the free slots or book. The salon can still put bookings in the ledger.',
      ja: '外すと、お客様は空き枠を見られず、予約できなくなります。サロンが台帳に入れる予約には使えます。',
    }),
    buildingDescription: text({
      en: 'The name of the building, the floor and the room number.',
      ja: '建物の名前と階、部屋の番号。',
    }),
    latitudeDescription: text({
      en: 'From -90 to 90. Used to show the salon on a map.',
      ja: '-90 から 90 まで。地図にサロンを示すときに使います。',
    }),
    longitudeDescription: text({
      en: 'From -180 to 180.',
      ja: '-180 から 180 まで。',
    }),
    phoneNumberDescription: text({
      en: 'With the area code.',
      ja: '市外局番から。',
    }),
    emailDescription: text({
      en: 'The address that takes the questions of customers. The address of another salon cannot be used.',
      ja: 'お客様からの問い合わせを受けるアドレス。ほかのサロンと同じアドレスは使えません。',
    }),
    imageUrlsDescription: text({
      en: 'One per line: photos of the salon and its interior.',
      ja: '1 行に 1 つ。店舗や内装の写真。',
    }),
    featuresDescription: text({
      en: 'Separate them with commas. Customers use them when they look for a salon.',
      ja: '「、」か「,」で区切って書きます。お客様がサロンを探すときに使います。',
    }),
    amenitiesDescription: text({
      en: 'Such as Wi-Fi or parking. Separate them with commas.',
      ja: 'Wi-Fi や駐車場など。「、」か「,」で区切って書きます。',
    }),
    taxRate: text({ en: 'Tax rate (%)', ja: '税率（%）' }),
    taxRateDescription: text({
      en: 'From 0 to 100, with up to 2 decimal places. Used to work out the checkouts from now on.',
      ja: '0 から 100 まで、小数は 2 桁まで。これからの会計の計算に使います。',
    }),
    /** The time zone and the currency of a salon that is changed, which stay */
    kept: (timezone: string, currency: string) =>
      text({
        en: `The time zone (${timezone}) and the currency (${currency}) cannot be changed. The times of the bookings and the prices are read in them.`,
        ja: `${SALON_WORDS.timezone.ja}（${timezone}）と${SALON_WORDS.currency.ja}（${currency}）は、変えられません。予約の日時と料金は、これらで読みます。`,
      }),
    timezoneDescription: text({
      en: 'The times of the bookings are read in this time zone. It cannot be changed once the salon is registered.',
      ja: '予約の日時は、このタイムゾーンで読みます。登録したあとは、変えられません。',
    }),
    currencyDescription: text({
      en: 'Prices and sales are written in this currency. It cannot be changed once the salon is registered.',
      ja: '料金と売上は、この通貨で表します。登録したあとは、変えられません。',
    }),
    /** A currency to choose, by its code and its name: 「JPY（日本円）」 */
    currencyChoice: (code: string, name: LocalizedText) =>
      text({ en: `${code} (${name.en})`, ja: `${code}（${name.ja}）` }),
    /** What the API refused, and what the form found wrong */
    errors: {
      latitude: text({
        en: 'Enter the latitude as a number from -90 to 90, with up to 8 decimal places.',
        ja: '緯度は、-90 から 90 までの数（小数は 8 桁まで）で入力してください。',
      }),
      longitude: text({
        en: 'Enter the longitude as a number from -180 to 180, with up to 8 decimal places.',
        ja: '経度は、-180 から 180 までの数（小数は 8 桁まで）で入力してください。',
      }),
      taxRate: text({
        en: 'Enter the tax rate as a number from 0 to 100, with up to 2 decimal places.',
        ja: '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
      }),
      emailTaken: text({
        en: 'Another salon uses this email address. Enter another email address.',
        ja: 'このメールアドレスは、ほかのサロンが使っています。ほかのメールアドレスを入力してください。',
      }),
      timezone: text({
        en: 'Choose a time zone.',
        ja: 'タイムゾーンを選んでください。',
      }),
      currency: text({
        en: 'Choose a currency.',
        ja: '通貨を選んでください。',
      }),
    },
  },
  change: {
    submit: text({ en: 'Save changes', ja: '変更を保存する' }),
    changed: text({
      en: 'Saved the salon information.',
      ja: 'サロンの情報を直しました。',
    }),
    /** The account may not keep the settings of the salon */
    forbidden: text({
      en: 'The settings of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its settings.',
      ja: 'このサロンの設定は、変えられません。設定を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    }),
    failed: text({
      en: 'Could not save the salon information. Check your connection and try again.',
      ja: 'サロンの情報を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  entry: {
    submit: text({ en: 'Register the salon', ja: 'サロンを登録する' }),
    description: text({
      en: 'The hours are entered in the settings of the salon once it is registered.',
      ja: '営業時間は、登録したあと、サロンの設定から入れます。',
    }),
    added: (name: string) =>
      text({
        en: `Registered the salon “${name}”. Enter its hours and its menu, then accept online bookings.`,
        ja: `サロン「${name}」を登録しました。営業時間とメニューを入れてから、オンライン予約を受け付けてください。`,
      }),
    /** The account may not register salons */
    forbidden: text({
      en: 'This account cannot register salons. Only administrators can register a salon.',
      ja: 'このアカウントでは、サロンを登録できません。サロンを登録できるのは、管理者です。',
    }),
    failed: text({
      en: 'Could not register the salon. Check your connection and try again.',
      ja: 'サロンを登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    toStart: text({ en: 'Back to the start', ja: 'トップへ戻る' }),
  },
}
