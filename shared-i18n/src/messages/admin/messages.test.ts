import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { JAPANESE, messagesOf } from '../__tests__/found-messages'
import { termMessages } from '../ui/terms'
import * as catalogues from './index'
import { adminCustomerMessages } from './index'

const FOUND = messagesOf(catalogues, '')

const {
  bulk,
  choices,
  erasure,
  exports,
  file,
  history,
  items,
  keeping,
  merge,
  naming,
  notices,
  points,
  record,
  removed,
  restoration,
  table,
  use,
  version,
} = adminCustomerMessages

/** A moment and a period, as the formats write them */
const MOMENT = {
  en: 'Tue, November 24, 2026 at 10:30',
  ja: '2026年11月24日（火） 10:30',
}
const PERIOD = {
  en: 'Mon, November 24, 2025 – Tue, November 24, 2026',
  ja: '2025年11月24日（月）〜2026年11月24日（火）',
}

/** A later moment, and a day, as the formats write them */
const LATER = {
  en: 'Wed, November 25, 2026 at 15:00',
  ja: '2026年11月25日（水） 15:00',
}
const DAY = { en: 'Tue, December 1, 2026', ja: '2026年12月1日（火）' }

/** A name and its reading, which stand in every language as they were written */
const NAME = '山田 花子'
const KANA = 'ヤマダ ハナコ'
const OTHER_NAME = '田中 優希'

/** The two customers of a merge, as it names them */
const HANAKO = adminCustomerMessages.merge.whoIs(NAME, 'hanako@example.com')
const YUKI = adminCustomerMessages.merge.whoIs(OTHER_NAME, 'yuki@example.com')

/** The largest balance of points */
const MOST_POINTS = 2_147_483_647

/** A sale that points are recorded for, as the form offers it */
const SALE_NUMBER = 'SL-2KQM-9F4H'
const SALE = adminCustomerMessages.points.sale.nameOf(SALE_NUMBER, MOMENT, {
  en: '¥8,800',
  ja: '￥8,800',
})

/** A tag, which stands as it was written */
const TAG = '秋のキャンペーン'

/** A column of a file, and what is said of its value */
const EMAIL = { en: 'Email address', ja: 'メールアドレス' }
const MISSING_EMAIL = {
  en: 'Enter the email address.',
  ja: 'メールアドレスを入力してください。',
}

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminCustomerMessages.naming.honored',
    naming.honored(NAME),
    { en: NAME, ja: '山田 花子 様' },
  ],
  [
    'adminCustomerMessages.naming.full',
    naming.full(NAME, KANA),
    { en: '山田 花子 (ヤマダ ハナコ)', ja: '山田 花子（ヤマダ ハナコ）' },
  ],
  [
    'adminCustomerMessages.naming.honoredFull',
    naming.honoredFull(NAME, KANA),
    { en: '山田 花子 (ヤマダ ハナコ)', ja: '山田 花子（ヤマダ ハナコ） 様' },
  ],
  [
    'adminCustomerMessages.table.chooseCustomer',
    table.chooseCustomer(NAME),
    { en: 'Select 山田 花子', ja: '山田 花子 様を選ぶ' },
  ],
  [
    'adminCustomerMessages.choices.thisCustomer',
    choices.thisCustomer(NAME),
    { en: '山田 花子 (this customer)', ja: '山田 花子（このお客様）' },
  ],
  [
    'adminCustomerMessages.notices.registered',
    notices.registered(NAME),
    {
      en: '山田 花子 was registered in the ledger.',
      ja: '山田 花子 様を台帳に登録しました。',
    },
  ],
  [
    'adminCustomerMessages.notices.removed',
    notices.removed(NAME),
    {
      en: '山田 花子 was removed from the ledger.',
      ja: '山田 花子 様を台帳から削除しました。',
    },
  ],
  [
    'adminCustomerMessages.notices.restored',
    notices.restored(NAME),
    {
      en: '山田 花子 was brought back to the ledger.',
      ja: '山田 花子 様を台帳に戻しました。',
    },
  ],
  [
    'adminCustomerMessages.record.visits.visitsOf',
    record.visits.visitsOf(12),
    { en: '12 visits', ja: '12 回' },
  ],
  [
    'adminCustomerMessages.record.visits.noShowsOf',
    record.visits.noShowsOf(1),
    { en: '1 no-show', ja: '1 回' },
  ],
  [
    'adminCustomerMessages.record.visits.cancellationsOf',
    record.visits.cancellationsOf(2),
    { en: '2 cancellations', ja: '2 回' },
  ],
  [
    'adminCustomerMessages.record.visits.pointsOf',
    record.visits.pointsOf(2500),
    { en: '2,500 points', ja: '2,500 ポイント' },
  ],
  [
    'adminCustomerMessages.items.listed',
    items.listed([
      termMessages.serviceCategory.cut,
      termMessages.serviceCategory.color,
    ]),
    { en: 'Cut, Color', ja: 'カット、カラー' },
  ],
  [
    'adminCustomerMessages.items.contactsOf',
    items.contactsOf([items.byEmail, items.bySms]),
    { en: 'Email, SMS', ja: 'メール、SMS' },
  ],
  [
    'adminCustomerMessages.items.hairOf',
    items.hairOf(
      termMessages.hairType.straight,
      termMessages.hairThickness.thin,
      termMessages.scalpCondition.dry,
    ) ?? { en: '', ja: '' },
    {
      en: 'Type: Straight; Thickness: Fine; Scalp: Dry',
      ja: 'ストレート、細い髪、頭皮は乾燥',
    },
  ],
  [
    'adminCustomerMessages.items.addressOf',
    items.addressOf(
      '150-0001',
      ['東京都', '渋谷区', '神宮前 4-1-1'],
      'ハイツ 101',
    ) ?? { en: '', ja: '' },
    {
      en: '150-0001 東京都 渋谷区 神宮前 4-1-1 ハイツ 101',
      ja: '〒150-0001 東京都渋谷区神宮前 4-1-1 ハイツ 101',
    },
  ],
  [
    'adminCustomerMessages.use.of',
    use.of(PERIOD),
    {
      en: 'Figures for Mon, November 24, 2025 – Tue, November 24, 2026',
      ja: '2025年11月24日（月）〜2026年11月24日（火）の集計',
    },
  ],
  [
    'adminCustomerMessages.use.bookingsOf',
    use.bookingsOf(3),
    { en: '3 bookings', ja: '3 件' },
  ],
  [
    'adminCustomerMessages.keeping.confirm',
    keeping.confirm(NAME),
    {
      en: 'Remove 山田 花子 from the ledger?',
      ja: '山田 花子 様を台帳から削除しますか？',
    },
  ],
  [
    'adminCustomerMessages.restoration.emailTaken',
    restoration.emailTaken('hanako@example.com'),
    {
      en: "A customer registered after the removal uses this customer's email address (hanako@example.com). Change that customer's email address, then bring this one back to the ledger.",
      ja: 'このお客様のメールアドレス（hanako@example.com）は、削除のあとに登録されたお客様が使っています。そのお客様のメールアドレスを変えてから、台帳に戻してください。',
    },
  ],
  [
    'adminCustomerMessages.removed.done',
    removed.done(MOMENT, history.changers.you, 'deleted'),
    {
      en: 'You removed this customer from the ledger on Tue, November 24, 2026 at 10:30.',
      ja: '2026年11月24日（火） 10:30 に、あなたが台帳から削除しました。',
    },
  ],
  [
    'adminCustomerMessages.history.versionOf',
    history.versionOf(3),
    { en: 'Version 3', ja: '版 3' },
  ],
  [
    'adminCustomerMessages.history.changedItems',
    history.changedItems([items.email, items.tags]),
    { en: 'Email address, Tags', ja: 'メールアドレス、タグ' },
  ],
  [
    'adminCustomerMessages.version.line',
    version.line([
      history.versionOf(3),
      history.operations.update,
      MOMENT,
      history.changers.you,
    ]),
    {
      en: 'Version 3 · Updated · Tue, November 24, 2026 at 10:30 · You',
      ja: '版 3・更新・2026年11月24日（火） 10:30・あなた',
    },
  ],
  [
    'adminCustomerMessages.points.movementOf',
    points.movementOf(-1200),
    { en: '−1,200', ja: '−1,200' },
  ],
  [
    'adminCustomerMessages.points.history.saleOf',
    points.history.saleOf(SALE_NUMBER),
    { en: 'Sale SL-2KQM-9F4H', ja: '売上 SL-2KQM-9F4H' },
  ],
  [
    'adminCustomerMessages.points.history.bookingOf',
    points.history.bookingOf('BK-4F7H-2KQM'),
    { en: 'Booking BK-4F7H-2KQM', ja: '予約 BK-4F7H-2KQM' },
  ],
  [
    'adminCustomerMessages.points.expiring.noneWithin',
    points.expiring.noneWithin(30),
    {
      en: 'No points expire within 30 days.',
      ja: '30 日以内に期限が来るポイントはありません。',
    },
  ],
  [
    'adminCustomerMessages.points.expiring.within',
    points.expiring.within(30, 1500, DAY),
    {
      en: 'Points expiring within 30 days: 1,500 points. The earliest expiry date is Tue, December 1, 2026.',
      ja: '30 日以内に期限が来るポイントは、1,500 ポイントです。最も早い期限は、2026年12月1日（火）です。',
    },
  ],
  [
    'adminCustomerMessages.points.expiring.expired',
    points.expiring.expired(DAY),
    {
      en: 'Tue, December 1, 2026 (expired)',
      ja: '2026年12月1日（火）（期限切れ）',
    },
  ],
  [
    'adminCustomerMessages.points.form.pointsDescription',
    points.form.pointsDescription(2500),
    {
      en: 'Enter a whole number of 1 or more. To take points away, enter how many to take away. The balance is now 2,500 points.',
      ja: '1 以上の整数で入れます。減らすときも、減らす数を入れます。いまの残高は 2,500 ポイントです。',
    },
  ],
  [
    'adminCustomerMessages.points.form.forSale',
    points.form.forSale(SALE),
    {
      en: 'Link to sale SL-2KQM-9F4H (Tue, November 24, 2026 at 10:30, ¥8,800)',
      ja: '売上番号 SL-2KQM-9F4H（2026年11月24日（火） 10:30、￥8,800）に結びつける',
    },
  ],
  [
    'adminCustomerMessages.points.form.pointsError',
    points.form.pointsError(MOST_POINTS),
    {
      en: 'Enter the points as a whole number from 1 to 2,147,483,647.',
      ja: 'ポイント数は、1 から 2,147,483,647 までの整数で入力してください。',
    },
  ],
  [
    'adminCustomerMessages.points.form.expiryError',
    points.form.expiryError({ en: 'December 31, 2999', ja: '2999年12月31日' }),
    {
      en: 'Enter an expiry date from today to December 31, 2999.',
      ja: '有効期限は、今日から2999年12月31日までの日付で入力してください。',
    },
  ],
  [
    'adminCustomerMessages.points.sale.nameOf',
    SALE,
    {
      en: 'sale SL-2KQM-9F4H (Tue, November 24, 2026 at 10:30, ¥8,800)',
      ja: '売上番号 SL-2KQM-9F4H（2026年11月24日（火） 10:30、￥8,800）',
    },
  ],
  [
    'adminCustomerMessages.points.recorded.earned',
    points.recorded.earned(500),
    { en: 'Gave 500 points.', ja: '500 ポイントを付与しました。' },
  ],
  [
    'adminCustomerMessages.points.recorded.used',
    points.recorded.used(1),
    { en: 'Recorded 1 point used.', ja: '1 ポイントを使いました。' },
  ],
  [
    'adminCustomerMessages.points.recorded.added',
    points.recorded.added(100),
    {
      en: 'Added 100 points by an adjustment.',
      ja: '調整で100 ポイント増やしました。',
    },
  ],
  [
    'adminCustomerMessages.points.recorded.taken',
    points.recorded.taken(100),
    {
      en: 'Took away 100 points by an adjustment.',
      ja: '調整で100 ポイント減らしました。',
    },
  ],
  [
    'adminCustomerMessages.points.recorded.withBalance',
    points.recorded.withBalance(points.recorded.earned(500), 2500),
    {
      en: 'Gave 500 points. The balance is now 2,500 points.',
      ja: '500 ポイントを付与しました。残高は 2,500 ポイントです。',
    },
  ],
  [
    'adminCustomerMessages.points.refusals.short',
    points.refusals.short(300),
    {
      en: 'You cannot take away more than the balance (300 points).',
      ja: '残高（300 ポイント）より多くは減らせません。',
    },
  ],
  [
    'adminCustomerMessages.points.refusals.over',
    points.refusals.over(MOST_POINTS),
    {
      en: 'This cannot be recorded: the balance would go over the limit (2,147,483,647 points).',
      ja: '残高が上限（2,147,483,647 ポイント）を超えるため、記録できません。',
    },
  ],
  [
    'adminCustomerMessages.file.how.oneOrNone',
    file.how.oneOrNone(['male', 'female', 'other']),
    {
      en: 'One of male, female, other. Empty for none',
      ja: 'male、female、other のどれか。空なら、なし',
    },
  ],
  [
    'adminCustomerMessages.file.how.oneOrElse',
    file.how.oneOrElse(['regular', 'silver', 'gold', 'platinum'], 'regular'),
    {
      en: 'One of regular, silver, gold, platinum. Without the column: regular',
      ja: 'regular、silver、gold、platinum のどれか。列がなければ regular',
    },
  ],
  [
    'adminCustomerMessages.file.how.switched',
    file.how.switched('false'),
    {
      en: 'Either true or false. Without the column: false',
      ja: 'true か false。列がなければ false',
    },
  ],
  [
    'adminCustomerMessages.file.problemOf',
    file.problemOf(3, EMAIL, MISSING_EMAIL),
    {
      en: 'Row 3, Email address: Enter the email address.',
      ja: '3 行目 メールアドレス: メールアドレスを入力してください。',
    },
  ],
  [
    'adminCustomerMessages.file.problems.twice',
    file.problems.twice('email'),
    {
      en: 'There are two columns “email”.',
      ja: '列「email」が 2 つあります。',
    },
  ],
  [
    'adminCustomerMessages.file.problems.unnamed',
    file.problems.unnamed(4),
    { en: 'Column 4 has no name.', ja: '4 列目に、列名がありません。' },
  ],
  [
    'adminCustomerMessages.file.problems.unknown',
    file.problems.unknown('mail'),
    {
      en: '“mail” is not an item of the ledger. Name the columns as in the table below.',
      ja: '列「mail」は、台帳の項目ではありません。列名は、下の表の名前で書いてください。',
    },
  ],
  [
    'adminCustomerMessages.file.problems.missing',
    file.problems.missing('phoneNumber', {
      en: 'Phone number',
      ja: '電話番号',
    }),
    {
      en: 'The column “phoneNumber” (Phone number) is missing.',
      ja: '列「phoneNumber」（電話番号）がありません。',
    },
  ],
  [
    'adminCustomerMessages.file.problems.cells',
    file.problems.cells(3, 4),
    {
      en: 'The row has 3 values, which does not match the number of columns (4).',
      ja: '値が 3 個あり、列の数（4）と合いません。',
    },
  ],
  [
    'adminCustomerMessages.file.problems.switched',
    file.problems.switched({ en: 'Messages by SMS', ja: 'SMS での連絡' }),
    {
      en: 'Write true or false.',
      ja: 'SMS での連絡は、true か false で書いてください。',
    },
  ],
  [
    'adminCustomerMessages.file.problems.choice',
    file.problems.choice({ en: 'Gender', ja: '性別' }, [
      'male',
      'female',
      'other',
    ]),
    {
      en: 'Write one of male, female, other.',
      ja: '性別は、male、female、other のどれかで書いてください。',
    },
  ],
  [
    'adminCustomerMessages.file.problems.preferences',
    file.problems.preferences(['cut', 'color']),
    {
      en: 'Write the preferences as JSON, as the ledger exports them ({"preferredServices":["cut"],"notes":null}), or leave them empty. preferredServices are each one of cut, color.',
      ja: '好みは、台帳の出力と同じ JSON（{"preferredServices":["cut"],"notes":null}）で書くか、空にしてください。preferredServices は、cut、color のどれかです。',
    },
  ],
  [
    'adminCustomerMessages.file.problems.sameEmailAs',
    file.problems.sameEmailAs(2),
    {
      en: 'The same email address as row 2.',
      ja: '2 行目と同じメールアドレスです。',
    },
  ],
  [
    'adminCustomerMessages.file.problems.sameCodeAs',
    file.problems.sameCodeAs(2),
    {
      en: 'The same referral code as row 2.',
      ja: '2 行目と同じ紹介コードです。',
    },
  ],
  [
    'adminCustomerMessages.file.problems.tooMany',
    file.problems.tooMany(1001, 100),
    {
      en: 'The file has 1,001 customers. Up to 100 customers can be registered at once. Split the file.',
      ja: 'ファイルには 1,001 人います。一度に登録できるのは 100 人までです。ファイルを分けてください。',
    },
  ],
  [
    'adminCustomerMessages.file.form.fileDescription',
    file.form.fileDescription(100),
    {
      en: 'A file of values separated by commas, in UTF-8 or Shift_JIS. The names of the columns in row 1, then one customer a row from row 2, up to 100 customers.',
      ja: 'UTF-8 か Shift_JIS の、カンマで区切ったファイル。1 行目に列名を、2 行目から 1 行に 1 人ずつ、100 人まで書きます。',
    },
  ],
  [
    'adminCustomerMessages.file.form.register',
    file.form.register(3),
    { en: 'Register 3 customers', ja: '3 人を登録する' },
  ],
  [
    'adminCustomerMessages.file.registration.registered',
    file.registration.registered(1),
    {
      en: 'Registered 1 customer in the ledger.',
      ja: '1 人を台帳に登録しました。',
    },
  ],
  [
    'adminCustomerMessages.file.registration.birthDate',
    file.registration.birthDate('1900-01-01'),
    {
      en: 'Write a date of birth from 1900-01-01 to today.',
      ja: '生年月日は、1900-01-01 から今日までの日付を書いてください。',
    },
  ],
  [
    'adminCustomerMessages.merge.whoIs',
    HANAKO,
    {
      en: '山田 花子 (hanako@example.com)',
      ja: '山田 花子 様（hanako@example.com）',
    },
  ],
  [
    'adminCustomerMessages.merge.chosen',
    merge.chosen(naming.full(NAME, KANA), 'hanako@example.com'),
    {
      en: '山田 花子 (ヤマダ ハナコ) (hanako@example.com)',
      ja: '山田 花子（ヤマダ ハナコ） 様（hanako@example.com）',
    },
  ],
  [
    'adminCustomerMessages.merge.compared.thisOne',
    merge.compared.thisOne(HANAKO),
    {
      en: 'This customer: 山田 花子 (hanako@example.com)',
      ja: 'このお客様: 山田 花子 様（hanako@example.com）',
    },
  ],
  [
    'adminCustomerMessages.merge.compared.chosenOne',
    merge.compared.chosenOne(YUKI),
    {
      en: 'Chosen customer: 田中 優希 (yuki@example.com)',
      ja: '選んだお客様: 田中 優希 様（yuki@example.com）',
    },
  ],
  [
    'adminCustomerMessages.merge.compared.keptColumn',
    merge.compared.keptColumn(NAME),
    { en: '山田 花子 (kept)', ja: '残す 山田 花子 様' },
  ],
  [
    'adminCustomerMessages.merge.compared.mergedColumn',
    merge.compared.mergedColumn(OTHER_NAME),
    { en: '田中 優希 (merged)', ja: 'まとめる 田中 優希 様' },
  ],
  [
    'adminCustomerMessages.merge.compared.whatMoves',
    merge.compared.whatMoves(NAME, 3000),
    {
      en: 'The bookings, sales, treatment records and reviews become those of 山田 花子. The preferences, charts and allergies of the two are put together. The points of the two balances are added up to 3,000 points.',
      ja: '予約、売上、施術記録、レビューは、山田 花子 様のものになります。好み設定、カルテ、アレルギーは、2 人のものを合わせます。ポイントは、2 人の残高を合わせて 3,000 ポイントになります。',
    },
  ],
  [
    'adminCustomerMessages.merge.obstacles.erasureAsked',
    merge.obstacles.erasureAsked(HANAKO),
    {
      en: 'A request of 山田 花子 (hanako@example.com) to have their data erased was taken. Cancel the request, then merge them.',
      ja: '山田 花子 様（hanako@example.com）から、データの削除の依頼を受け付けています。依頼を取り消してから、まとめてください。',
    },
  ],
  [
    'adminCustomerMessages.merge.obstacles.points',
    merge.obstacles.points(MOST_POINTS + 1, MOST_POINTS),
    {
      en: 'Together the two have 2,147,483,648 points, more than the 2,147,483,647 points one customer can hold.',
      ja: '2 人のポイントを合わせると 2,147,483,648 ポイントになり、1 人が持てる 2,147,483,647 ポイントを超えます。',
    },
  ],
  [
    'adminCustomerMessages.merge.obstacles.chart',
    merge.obstacles.chart(merge.names.previousTreatments, 50),
    {
      en: 'Together the two charts have more than 50 entries in the treatment history. Shorten one of the charts, then merge them.',
      ja: '2 人のカルテを合わせると、施術歴が 50 件を超えます。どちらかのカルテを短くしてから、まとめてください。',
    },
  ],
  [
    'adminCustomerMessages.merge.confirmDescription',
    merge.confirmDescription(HANAKO, YUKI),
    {
      en: '山田 花子 (hanako@example.com) is kept, and 田中 優希 (yuki@example.com) is removed from the ledger. A customer removed by a merge cannot be brought back to the ledger.',
      ja: '山田 花子 様（hanako@example.com）を残し、田中 優希 様（yuki@example.com）を台帳から削除します。削除したお客様は、台帳に戻せません。',
    },
  ],
  [
    'adminCustomerMessages.merge.done',
    merge.done(NAME),
    {
      en: 'The two customers were merged into 山田 花子.',
      ja: '2 人のお客様を、山田 花子 様にまとめました。',
    },
  ],
  [
    'adminCustomerMessages.merge.gone',
    merge.gone([HANAKO, YUKI]),
    {
      en: 'No longer in the ledger: 山田 花子 (hanako@example.com) and 田中 優希 (yuki@example.com). On another screen, they were removed from the ledger or merged into another customer.',
      ja: '山田 花子 様（hanako@example.com）と田中 優希 様（yuki@example.com）は、もう台帳にいません。ほかの画面で、台帳から削除されたか、ほかのお客様にまとめられました。',
    },
  ],
  [
    'adminCustomerMessages.bulk.chosen.count',
    bulk.chosen.count(3),
    { en: '3 customers chosen', ja: '3 人を選んでいます' },
  ],
  [
    'adminCustomerMessages.bulk.chosen.tooMany',
    bulk.chosen.tooMany(100),
    {
      en: 'Up to 100 customers can be handled at once. Choose fewer customers.',
      ja: '一度に操作できるのは 100 人までです。選ぶお客様を減らしてください。',
    },
  ],
  [
    'adminCustomerMessages.bulk.tag.title',
    bulk.tag.title(3),
    { en: 'Tag of the chosen customers (3)', ja: '選んだ 3 人のタグ' },
  ],
  [
    'adminCustomerMessages.bulk.removal.title',
    bulk.removal.title(1),
    {
      en: 'Remove 1 customer from the ledger?',
      ja: '1 人のお客様を台帳から削除しますか？',
    },
  ],
  [
    'adminCustomerMessages.bulk.retagging.added',
    bulk.retagging.added(3, TAG),
    {
      en: 'Added the tag “秋のキャンペーン” to 3 customers.',
      ja: '3 人にタグ「秋のキャンペーン」を付けました。',
    },
  ],
  [
    'adminCustomerMessages.bulk.retagging.removed',
    bulk.retagging.removed(3, TAG),
    {
      en: 'Removed the tag “秋のキャンペーン” from 3 customers.',
      ja: '3 人からタグ「秋のキャンペーン」を外しました。',
    },
  ],
  [
    'adminCustomerMessages.bulk.retagging.addedAlready',
    bulk.retagging.addedAlready(TAG),
    {
      en: 'The chosen customers already have the tag “秋のキャンペーン”.',
      ja: '選んだお客様には、もうタグ「秋のキャンペーン」が付いています。',
    },
  ],
  [
    'adminCustomerMessages.bulk.retagging.noneHave',
    bulk.retagging.noneHave(TAG),
    {
      en: 'None of the chosen customers has the tag “秋のキャンペーン”.',
      ja: '選んだお客様に、タグ「秋のキャンペーン」の付いた人はいません。',
    },
  ],
  [
    'adminCustomerMessages.bulk.removing.removed',
    bulk.removing.removed(2),
    {
      en: 'Removed 2 customers from the ledger.',
      ja: '2 人を台帳から削除しました。',
    },
  ],
  [
    'adminCustomerMessages.bulk.removing.unfinished',
    bulk.removing.unfinished(NAME),
    {
      en: '山田 花子 has bookings that are not finished. Complete, cancel or delete those bookings, then try again. Nobody was removed.',
      ja: '山田 花子 様には、終わっていない予約があります。予約を完了、キャンセル、または削除してから、もう一度お試しください。だれも削除していません。',
    },
  ],
  [
    'adminCustomerMessages.bulk.gone',
    bulk.gone([NAME, OTHER_NAME], bulk.retagging.unchanged),
    {
      en: 'No longer in the ledger: 山田 花子, 田中 優希. They are no longer chosen, and the ledger was loaded again. No tags were changed.',
      ja: '選んだお客様のうち、山田 花子 様、田中 優希 様は、もう台帳にいません。そのお客様を選ぶのをやめ、台帳を読み直しました。だれのタグも変えていません。',
    },
  ],
  [
    'adminCustomerMessages.exports.ledger.exported',
    exports.ledger.exported(3, 'customers.csv'),
    {
      en: 'Exported 3 customers to customers.csv.',
      ja: '3 人のお客様を、customers.csv に出力しました。',
    },
  ],
  [
    'adminCustomerMessages.exports.ledger.tooMany',
    exports.ledger.tooMany(10_000),
    {
      en: 'More than 10,000 customers match the filters, so they cannot be exported. Narrow the filters, then export again.',
      ja: '条件に合うお客様が 10,000 人を超えるため、出力できません。条件を絞ってから、もう一度出力してください。',
    },
  ],
  [
    'adminCustomerMessages.exports.data.exported',
    exports.data.exported(NAME, 'customer.json'),
    {
      en: 'Exported the data of 山田 花子 to customer.json.',
      ja: '山田 花子 様のデータを、customer.json に出力しました。',
    },
  ],
  [
    'adminCustomerMessages.erasure.pending.scheduledOf',
    erasure.pending.scheduledOf(MOMENT),
    {
      en: 'On or after Tue, November 24, 2026 at 10:30',
      ja: '2026年11月24日（火） 10:30 以降',
    },
  ],
  [
    'adminCustomerMessages.erasure.cancelled',
    erasure.cancelled(MOMENT, LATER),
    {
      en: 'The request taken on Tue, November 24, 2026 at 10:30 was cancelled on Wed, November 25, 2026 at 15:00.',
      ja: '2026年11月24日（火） 10:30 に受け付けた依頼は、2026年11月25日（水） 15:00 に取り消しました。',
    },
  ],
  [
    'adminCustomerMessages.erasure.completed',
    erasure.completed(MOMENT, LATER),
    {
      en: 'The data was erased on Wed, November 25, 2026 at 15:00, on the request taken on Tue, November 24, 2026 at 10:30. Let the customer know that the data was erased.',
      ja: '2026年11月24日（火） 10:30 に受け付けた依頼により、2026年11月25日（水） 15:00 にデータを消去しました。消去したことを、ご本人にお知らせください。',
    },
  ],
  [
    'adminCustomerMessages.erasure.asking.description',
    erasure.asking.description(NAME),
    {
      en: 'The request to erase the data of 山田 花子 will be taken. It can be cancelled for 14 days after it is taken.',
      ja: '山田 花子 様のデータの消去の依頼を受け付けます。受け付けてから 14 日のあいだは、取り消せます。',
    },
  ],
  [
    'adminCustomerMessages.erasure.cancelling.description',
    erasure.cancelling.description(NAME),
    {
      en: 'The data of 山田 花子 will not be erased. Cancel a request when the customer withdraws it, or when it was taken by mistake.',
      ja: '山田 花子 様のデータは消去されません。ご本人が依頼を撤回したときや、誤って受け付けたときに取り消します。',
    },
  ],
  [
    'adminCustomerMessages.erasure.asked',
    erasure.asked(NAME, LATER),
    {
      en: 'The request to erase the data of 山田 花子 was taken. The data will be erased on or after Wed, November 25, 2026 at 15:00.',
      ja: '山田 花子 様のデータの消去の依頼を受け付けました。2026年11月25日（水） 15:00 以降に消去します。',
    },
  ],
  [
    'adminCustomerMessages.erasure.cancelledDone',
    erasure.cancelledDone(NAME),
    {
      en: 'The request to erase the data of 山田 花子 was cancelled.',
      ja: '山田 花子 様のデータの消去の依頼を取り消しました。',
    },
  ],
]

/** The catalogues whose messages that are made from a value are tested in a file of their own (`bookings.test.ts`, `charts.test.ts`, `inventory.test.ts`, `menu.test.ts`, `payment-methods.test.ts`, `products.test.ts`, `purchase-orders.test.ts`, `sales.test.ts`, `settings.test.ts`, `staff.test.ts`, `treatments.test.ts`) */
const TESTED_APART = [
  'adminBookingMessages',
  'adminChartMessages',
  'adminInventoryMessages',
  'adminMenuMessages',
  'adminPaymentMethodMessages',
  'adminProductMessages',
  'adminPurchaseOrderMessages',
  'adminReviewMessages',
  'adminReviewReportMessages',
  'adminSaleMessages',
  'adminSettingsMessages',
  'adminShiftMessages',
  'adminStaffMessages',
  'adminTreatmentMessages',
]

/** A name that stands inside a sentence: it begins as it stands there */
const INSIDE_A_SENTENCE = /\.names\./

/** The words that are written in Latin letters in every language */
const WRITTEN_ALIKE = [
  'adminCustomerMessages.statuses.vip',
  'adminCustomerMessages.items.bySms',
]

/** The remarks that follow the word of a badge, in brackets */
const AFTER_A_WORD = ['adminBookingMessages.moves.check.withinCapacity']

describe('the messages of the admin application', () => {
  it.each(
    FOUND.texts.filter(
      ([where]) =>
        !INSIDE_A_SENTENCE.test(where) &&
        !WRITTEN_ALIKE.includes(where) &&
        !AFTER_A_WORD.includes(where),
    ),
  )('should be written in each language: %s', (_where, written) => {
    // Assert
    expect(written.en).toMatch(/^[A-Z]/)
    expect(written.en).not.toMatch(JAPANESE)
    expect(written.ja).toMatch(JAPANESE)
  })

  it.each(FOUND.texts.filter(([where]) => INSIDE_A_SENTENCE.test(where)))(
    'should be written in each language as it stands inside a sentence: %s',
    (_where, written) => {
      // Assert
      expect(written.en).toMatch(/^[a-z]/)
      expect(written.en).not.toMatch(JAPANESE)
      expect(written.ja).toMatch(JAPANESE)
    },
  )

  it.each(FOUND.texts.filter(([where]) => AFTER_A_WORD.includes(where)))(
    'should be written in each language as a remark in brackets after a word: %s',
    (_where, written) => {
      // Assert
      expect(written.en).toMatch(/^ \([a-z][^)]*\)$/)
      expect(written.ja).toMatch(/^（[^）]+）$/)
      expect(written.ja).toMatch(JAPANESE)
    },
  )

  it.each(FOUND.texts.filter(([where]) => WRITTEN_ALIKE.includes(where)))(
    'should be written alike in each language, in Latin letters: %s',
    (_where, written) => {
      // Assert
      expect(written.ja).toBe(written.en)
      expect(written.en).toMatch(/^[A-Z]+$/)
    },
  )

  it('should find every word that is written alike in the catalogues', () => {
    // Act
    const found = FOUND.texts
      .map(([where]) => where)
      .filter((where) => WRITTEN_ALIKE.includes(where))

    // Assert
    expect(found.toSorted()).toEqual(WRITTEN_ALIKE.toSorted())
  })

  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      FOUND.made
        .filter(
          (where) => !TESTED_APART.some((name) => where.startsWith(`${name}.`)),
        )
        .toSorted(),
    )
  })

  it('should name the customer alone when there is no reading of the name', () => {
    // Assert
    expect(naming.full(NAME, '')).toEqual({ en: NAME, ja: NAME })
    expect(naming.honoredFull(NAME, '')).toEqual({
      en: NAME,
      ja: '山田 花子 様',
    })
  })

  it('should say that no way of contact is allowed when none is', () => {
    // Assert
    expect(items.contactsOf([])).toEqual({
      en: 'None allowed',
      ja: '受け取らない',
    })
  })

  it('should say only what was recorded of the hair, and nothing when none was', () => {
    // Assert
    expect(items.hairOf(null, null, termMessages.scalpCondition.oily)).toEqual({
      en: 'Scalp: Oily',
      ja: '頭皮は脂性',
    })
    expect(items.hairOf(null, null, null)).toBeNull()
  })

  it('should write only the parts of an address that were recorded, and nothing when none was', () => {
    // Assert
    expect(items.addressOf(null, [], 'ハイツ 101')).toEqual({
      en: 'ハイツ 101',
      ja: 'ハイツ 101',
    })
    expect(items.addressOf(null, [], null)).toBeNull()
  })

  it('should say the items a version changed, and that there was none', () => {
    // Assert
    expect(history.changedItems([])).toEqual({ en: 'None', ja: 'なし' })
  })

  it('should say how a customer left the ledger, by whom and when', () => {
    // Assert
    expect(removed.done(MOMENT, history.changers.another, 'merged')).toEqual({
      en: 'Another account merged this customer into another on Tue, November 24, 2026 at 10:30.',
      ja: '2026年11月24日（火） 10:30 に、ほかのアカウントがほかのお客様に統合しました。',
    })
    expect(removed.done(MOMENT, history.changers.another, 'erased')).toEqual({
      en: 'Another account erased this customer on a deletion request on Tue, November 24, 2026 at 10:30.',
      ja: '2026年11月24日（火） 10:30 に、ほかのアカウントが削除の依頼で消去しました。',
    })
    expect(removed.done(MOMENT, null, 'deleted')).toEqual({
      en: 'Somebody removed this customer from the ledger on Tue, November 24, 2026 at 10:30.',
      ja: '2026年11月24日（火） 10:30 に、台帳から削除しました。',
    })
  })

  it('should say a refusal and who may do it, one sentence after another', () => {
    // Assert
    expect(adminCustomerMessages.removal.forbidden).toEqual({
      en: 'This account cannot remove customers from the ledger. Owners and managers remove customers from the ledger, merge them and read the change history.',
      ja: 'このアカウントでは、お客様を台帳から削除できません。台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
    })
  })
  it('should write a count of points that was added with its sign', () => {
    // Assert
    expect(points.movementOf(500)).toEqual({ en: '+500', ja: '+500' })
  })

  it('should say how a count of points is typed, and the balance only when it was read', () => {
    // Assert
    expect(points.form.pointsDescription(undefined)).toEqual({
      en: 'Enter a whole number of 1 or more. To take points away, enter how many to take away.',
      ja: '1 以上の整数で入れます。減らすときも、減らす数を入れます。',
    })
  })

  it('should say what is wrong with a row, and with the whole file, without a column', () => {
    // Assert
    expect(file.problemOf(3, null, MISSING_EMAIL)).toEqual({
      en: 'Row 3: Enter the email address.',
      ja: '3 行目: メールアドレスを入力してください。',
    })
    expect(file.problemOf(null, null, MISSING_EMAIL)).toEqual(MISSING_EMAIL)
  })

  it('should name no count on the button before a file is read', () => {
    // Assert
    expect(file.form.register(0)).toEqual({ en: 'Register', ja: '登録する' })
  })

  it('should say that a chosen customer has bookings that are not finished when the API names none of them', () => {
    // Assert
    expect(bulk.removing.unfinished(undefined)).toEqual({
      en: 'Some of the chosen customers have bookings that are not finished. Complete, cancel or delete those bookings, then try again. Nobody was removed.',
      ja: '選んだお客様のなかに、終わっていない予約のあるお客様がいます。予約を完了、キャンセル、または削除してから、もう一度お試しください。だれも削除していません。',
    })
  })

  it('should say what became of a request to erase the data when the API does not say when', () => {
    // Assert
    expect(erasure.cancelled(MOMENT, null)).toEqual({
      en: 'The request taken on Tue, November 24, 2026 at 10:30 was cancelled.',
      ja: '2026年11月24日（火） 10:30 に受け付けた依頼は、取り消しました。',
    })
    expect(erasure.completed(MOMENT, null)).toEqual({
      en: 'The data was erased on the request taken on Tue, November 24, 2026 at 10:30. Let the customer know that the data was erased.',
      ja: '2026年11月24日（火） 10:30 に受け付けた依頼により、データを消去しました。消去したことを、ご本人にお知らせください。',
    })
  })

  it('should name one customer of a merge who left the ledger', () => {
    // Assert
    expect(merge.gone([YUKI])).toEqual({
      en: 'No longer in the ledger: 田中 優希 (yuki@example.com). On another screen, they were removed from the ledger or merged into another customer.',
      ja: '田中 優希 様（yuki@example.com）は、もう台帳にいません。ほかの画面で、台帳から削除されたか、ほかのお客様にまとめられました。',
    })
  })
})
