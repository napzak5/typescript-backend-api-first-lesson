import { type LocalizedText, text } from '../../languages/localized-text'
import { countOf } from '../written'
import { staffForm } from './staff-form'
import { staffIntroduction } from './staff-introduction'
import { STAFF_WORDS, staffCalled } from './staff-words'

/*
 * What the admin application says of the members of the staff: the staff
 * ledger, a member shown, registered, changed and removed, how a member is
 * introduced to the customers, and who may keep the ledger; and how a
 * member is named wherever a screen names them (the bookings, the sales,
 * the customers, the treatments, the stock and the orders). The names,
 * their readings, the display names, the staff codes, the positions, the
 * employment types, the addresses of mail, the telephone numbers, the
 * specialties, the certifications and the bios stand as they were written.
 */

const LEDGER = text({ en: 'Staff', ja: 'スタッフ' })

/** The bookings a member takes at a time: 「3 件」 */
const bookingsOf = (count: number): LocalizedText =>
  countOf(count, 'booking', 'bookings', '件')

export const adminStaffMessages = {
  /** A member the salon does not show any more (removed, or not working there now): one is named, though not by name */
  unlisted: text({ en: 'Staff member not listed', ja: '一覧にないスタッフ' }),
  /** Nobody is recorded for a line of a booking or of a sale: it takes nobody's time */
  unassigned: text({ en: 'Unassigned', ja: '未定' }),
  /** A member by the name the salon shows them under, which stands as it was written in every language */
  named: (displayName: string) => text({ en: displayName, ja: displayName }),
  /** A member as the screens call them: 「Hiroshi Tanaka さん」 */
  called: staffCalled,
  /** The name of a member with its reading, when there is one: 「Tanaka Hiroshi（タナカ ヒロシ）」 */
  fullName: (name: string, kana: string): LocalizedText =>
    kana === ''
      ? text({ en: name, ja: name })
      : text({ en: `${name} (${kana})`, ja: `${name}（${kana}）` }),
  titles: {
    ledger: LEDGER,
    member: text({ en: 'Staff member details', ja: 'スタッフの内容' }),
    entry: text({ en: 'Register a staff member', ja: 'スタッフを登録する' }),
    change: text({ en: 'Edit the staff member', ja: 'スタッフ情報を直す' }),
  },
  /** What a screen could not read, as a sentence names it */
  names: {
    staff: text({ en: 'the staff', ja: 'スタッフ' }),
    member: text({ en: 'the staff member', ja: 'スタッフ' }),
  },
  loading: {
    staff: text({ en: 'Loading the staff', ja: 'スタッフを読み込んでいます' }),
    member: text({
      en: 'Loading the staff member',
      ja: 'スタッフを読み込んでいます',
    }),
  },
  words: STAFF_WORDS,
  /** How the record of a member is shown */
  values: {
    active: text({ en: 'Active', ja: '有効' }),
    inactive: text({ en: 'Inactive', ja: '無効' }),
    takesBookings: text({ en: 'Accepted', ja: '受ける' }),
    takesNoBookings: text({ en: 'Not accepted', ja: '受けない' }),
    linked: text({ en: 'Linked', ja: '紐づいています' }),
    notLinked: text({ en: 'Not linked', ja: '紐づいていません' }),
    /** The bookings a member takes at a time: 「3 件まで」 */
    concurrentBookingsOf: (count: number) =>
      text({
        en: `Up to ${bookingsOf(count).en}`,
        ja: `${bookingsOf(count).ja}まで`,
      }),
    /** The years of experience: 「5 年」 */
    yearsOf: (years: number) => countOf(years, 'year', 'years', '年'),
  },
  ledger: {
    register: text({ en: 'Register a staff member', ja: 'スタッフを登録する' }),
    none: text({ en: 'No staff members', ja: 'スタッフはいません' }),
    noneDescription: text({
      en: 'Register the staff who work at the salon in the ledger.',
      ja: 'サロンで働くスタッフを、台帳に登録してください。',
    }),
  },
  member: {
    own: text({
      en: 'This is your own staff record. This account can neither make it inactive nor remove it.',
      ja: 'ご自身のスタッフ情報です。このアカウントからは、無効にすることも、削除することもできません。',
    }),
    change: text({ en: 'Edit the staff member', ja: 'スタッフ情報を直す' }),
    schedule: text({ en: 'Work schedule', ja: '勤務スケジュール' }),
    account: STAFF_WORDS.account,
  },
  /** What a screen of the ledger says to an account that does not keep it */
  keepers: {
    forbidden: text({
      en: 'The staff ledger of this salon cannot be kept from this account. Only the owner of that salon and administrators can keep its staff ledger.',
      ja: 'このサロンのスタッフ台帳は、扱えません。スタッフ台帳を扱えるのは、そのサロンのオーナーと、管理者です。',
    }),
    toStart: text({ en: 'Back to the start', ja: 'トップへ戻る' }),
  },
  /** A screen of a member when there is none to show */
  notFound: {
    title: text({
      en: 'Staff member not found',
      ja: 'スタッフが見つかりません',
    }),
    description: text({
      en: 'Check that the address is right. A staff member removed from the ledger cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。台帳から削除したスタッフは、表示できません。',
    }),
  },
  introduction: staffIntroduction,
  ...staffForm,
}
