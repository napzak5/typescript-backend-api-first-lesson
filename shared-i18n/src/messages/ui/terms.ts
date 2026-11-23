import { text } from '../../languages/localized-text'

/**
 * The words of the business that more than one application or package
 * shows: the names of the values of the enums of the contract, under the
 * values. A screen keeps them under the type of the enum
 * (`Record<ModelsBookingStatusType, LocalizedText>`), so a value of the
 * contract without a name does not compile.
 */
export const termMessages = {
  /** The state of a booking, as the salon names it */
  bookingStatus: {
    draft: text({ en: 'Draft', ja: '下書き' }),
    pending: text({ en: 'Awaiting confirmation', ja: '確定待ち' }),
    confirmed: text({ en: 'Confirmed', ja: '確定' }),
    in_progress: text({ en: 'In progress', ja: '施術中' }),
    completed: text({ en: 'Completed', ja: '完了' }),
    cancelled: text({ en: 'Cancelled', ja: 'キャンセル' }),
    no_show: text({ en: 'No-show', ja: '無断キャンセル' }),
  },
  /** A booking the customer did not come to, as the customer is told it: no blame in it */
  notVisited: text({ en: 'Did not visit', ja: '来店なし' }),
  gender: {
    male: text({ en: 'Male', ja: '男性' }),
    female: text({ en: 'Female', ja: '女性' }),
    other: text({ en: 'Other', ja: 'その他' }),
    prefer_not_to_say: text({ en: 'Prefer not to say', ja: '回答しない' }),
  },
  hairType: {
    straight: text({ en: 'Straight', ja: 'ストレート' }),
    wavy: text({ en: 'Wavy', ja: 'ウェーブ' }),
    curly: text({ en: 'Curly', ja: 'カール' }),
    coily: text({ en: 'Coily', ja: '強いカール' }),
  },
  hairThickness: {
    thin: text({ en: 'Fine', ja: '細い' }),
    medium: text({ en: 'Medium', ja: 'ふつう' }),
    thick: text({ en: 'Thick', ja: '太い' }),
  },
  scalpCondition: {
    normal: text({ en: 'Normal', ja: 'ふつう' }),
    dry: text({ en: 'Dry', ja: '乾燥' }),
    oily: text({ en: 'Oily', ja: '脂性' }),
    sensitive: text({ en: 'Sensitive', ja: '敏感' }),
    dandruff: text({ en: 'Prone to dandruff', ja: 'フケが出やすい' }),
  },
  membershipTier: {
    regular: text({ en: 'Regular', ja: 'レギュラー' }),
    silver: text({ en: 'Silver', ja: 'シルバー' }),
    gold: text({ en: 'Gold', ja: 'ゴールド' }),
    platinum: text({ en: 'Platinum', ja: 'プラチナ' }),
    /** The same word in every language */
    vip: text({ en: 'VIP', ja: 'VIP' }),
  },
  /** The role of a member of the staff of a salon */
  salonRole: {
    owner: text({ en: 'Owner', ja: 'オーナー' }),
    manager: text({ en: 'Manager', ja: 'マネージャー' }),
    staff: text({ en: 'Staff', ja: 'スタッフ' }),
  },
  staffLevel: {
    junior: text({ en: 'Junior', ja: 'ジュニア' }),
    stylist: text({ en: 'Stylist', ja: 'スタイリスト' }),
    senior: text({ en: 'Senior', ja: 'シニア' }),
    expert: text({ en: 'Expert', ja: 'エキスパート' }),
    director: text({ en: 'Director', ja: 'ディレクター' }),
  },
  /** A day of the week, as a timetable names it: 「月曜日」 */
  dayOfWeek: {
    monday: text({ en: 'Monday', ja: '月曜日' }),
    tuesday: text({ en: 'Tuesday', ja: '火曜日' }),
    wednesday: text({ en: 'Wednesday', ja: '水曜日' }),
    thursday: text({ en: 'Thursday', ja: '木曜日' }),
    friday: text({ en: 'Friday', ja: '金曜日' }),
    saturday: text({ en: 'Saturday', ja: '土曜日' }),
    sunday: text({ en: 'Sunday', ja: '日曜日' }),
  },
  /** The kind of a service: 「カラー」 */
  serviceCategory: {
    cut: text({ en: 'Cut', ja: 'カット' }),
    color: text({ en: 'Color', ja: 'カラー' }),
    perm: text({ en: 'Perm', ja: 'パーマ' }),
    treatment: text({ en: 'Treatment', ja: 'トリートメント' }),
    spa: text({ en: 'Spa', ja: 'スパ' }),
    styling: text({ en: 'Styling', ja: 'スタイリング' }),
    extension: text({ en: 'Extensions', ja: 'エクステンション' }),
    other: text({ en: 'Other', ja: 'その他' }),
  },
  /** A kind of payment, in the word the salon uses */
  paymentMethod: {
    cash: text({ en: 'Cash', ja: '現金' }),
    credit_card: text({ en: 'Credit card', ja: 'クレジットカード' }),
    debit_card: text({ en: 'Debit card', ja: 'デビットカード' }),
    e_money: text({ en: 'E-money', ja: '電子マネー' }),
    qr_payment: text({ en: 'QR code payment', ja: 'QR コード決済' }),
    bank_transfer: text({ en: 'Bank transfer', ja: '銀行振込' }),
    point: text({ en: 'Points', ja: 'ポイント' }),
  },
  /** The kind of a file that is attached or shared, by its content type */
  contentType: {
    'image/jpeg': text({ en: 'JPEG image', ja: 'JPEG 画像' }),
    'image/png': text({ en: 'PNG image', ja: 'PNG 画像' }),
    'image/webp': text({ en: 'WebP image', ja: 'WebP 画像' }),
    /** The same word in every language */
    'application/pdf': text({ en: 'PDF', ja: 'PDF' }),
  },
}
