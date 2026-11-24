import { numberOf } from '../../formats/numbers'
import { text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { termMessages } from '../ui/terms'
import { followed, listed } from '../written'
import { STAFF_KEPT_BY, staffCalled } from './staff-words'

/*
 * The form of a member of the staff ledger, which registers one and
 * changes one, what it says after the API took it or not, and the removal
 * of a member.
 */

/** The states of the bookings that keep a member in the ledger: those that are not finished */
const UNFINISHED = listed([
  termMessages.bookingStatus.draft,
  termMessages.bookingStatus.pending,
  termMessages.bookingStatus.confirmed,
  termMessages.bookingStatus.in_progress,
])

export const staffForm = {
  form: {
    displayNameDescription: text({
      en: 'The name customers see when they book.',
      ja: 'お客様が予約するときに見る名前です。',
    }),
    emailDescription: text({
      en: 'No two staff members of the salon can have the same address.',
      ja: 'サロンのスタッフの間で、同じアドレスは使えません。',
    }),
    staffCodeDescription: text({
      en: 'Such as an employee number. No two staff members can have the same code, staff members removed from the ledger included.',
      ja: '社員番号など。台帳から削除したスタッフのものも含めて、同じコードは使えません。',
    }),
    choose: text({ en: 'Choose', ja: '選んでください' }),
    employmentTypeDescription: text({
      en: 'Such as full-time, part-time or contractor.',
      ja: '正社員、パート、業務委託など。',
    }),
    hireDateDescription: text({
      en: 'A staff member who has yet to join can be registered in advance.',
      ja: 'これから入社するスタッフも、先に登録できます。',
    }),
    baseSalary: text({ en: 'Base salary (yen)', ja: '基本給（円）' }),
    baseSalaryDescription: text({
      en: 'A whole number from 0.',
      ja: '0 以上の整数。',
    }),
    commissionRate: text({ en: 'Commission rate (%)', ja: '歩合率（%）' }),
    /** The largest rate the API takes, with up to two decimal places */
    commissionRateDescription: (most: number) =>
      text({
        en: `From 0 to ${numberOf(most).en}, with up to 2 decimal places.`,
        ja: `0 から ${numberOf(most).ja} まで。小数第 2 位まで。`,
      }),
    introductionDescription: text({
      en: 'How the staff member is introduced to customers, together with the display name, the level and the position.',
      ja: '表示名、レベル、役職と一緒に、お客様に見せるスタッフの紹介です。',
    }),
    canReceiveBookings: text({ en: 'Take bookings', ja: '予約を受ける' }),
    canReceiveBookingsDescription: text({
      en: 'Without it, the staff member is not offered among the open times when customers book. Bookings the salon puts in can be assigned to them either way.',
      ja: '外すと、お客様が予約するときの空き枠に出なくなります。サロンが入れる予約の担当には、どちらでも選べます。',
    }),
    maxConcurrentBookings: text({
      en: 'Number of concurrent bookings',
      ja: '同時に担当できる予約の数',
    }),
    /** The most bookings the API lets a member take at a time */
    maxConcurrentBookingsDescription: (most: number) =>
      text({
        en: `From 1 to ${numberOf(most).en}.`,
        ja: `1 から ${numberOf(most).ja} まで。`,
      }),
    bufferTimeBefore: text({
      en: 'Time kept before a booking (min)',
      ja: '予約の前に確保する時間（分）',
    }),
    /** The most minutes the API keeps before a booking */
    bufferTimeBeforeDescription: (most: number) =>
      text({
        en: `Time to prepare. From 0 to ${numberOf(most).en}.`,
        ja: `準備の時間。0 から ${numberOf(most).ja} まで。`,
      }),
    bufferTimeAfter: text({
      en: 'Time kept after a booking (min)',
      ja: '予約の後に確保する時間（分）',
    }),
    /** The most minutes the API keeps after a booking */
    bufferTimeAfterDescription: (most: number) =>
      text({
        en: `Time to tidy up. From 0 to ${numberOf(most).en}.`,
        ja: `片付けの時間。0 から ${numberOf(most).ja} まで。`,
      }),
    activity: text({ en: 'Employment status', ja: '在籍' }),
    isActive: text({ en: 'Active staff member', ja: '有効なスタッフ' }),
    isActiveDescription: text({
      en: 'Clear it during a leave or while the staff member leaves the salon. Without it, their sign-in account can no longer use the screens of the salon, and customers no longer see them when they book. Check it again to restore both.',
      ja: '休職や退職の手続きの間は外します。外すと、このスタッフのログインアカウントはサロンの画面を使えなくなり、お客様が予約するときにも出なくなります。付け直すと、元に戻ります。',
    }),
    /** What the API refused, and what the form found wrong */
    errors: {
      displayNameMissing: text({
        en: 'Enter the display name.',
        ja: '表示名を入力してください。',
      }),
      levelMissing: text({
        en: 'Choose the level.',
        ja: 'レベルを選んでください。',
      }),
      hireDate: text({
        en: 'Enter a hire date from January 1, 1900 to December 31, 2999.',
        ja: '入社日は、1900 年 1 月 1 日から 2999 年 12 月 31 日までの日付を入力してください。',
      }),
      baseSalary: text({
        en: 'Enter the base salary as a whole number of yen from 0.',
        ja: '基本給は、0 以上の円の整数で入力してください。',
      }),
      /** The largest rate the API takes */
      commissionRate: (most: number) =>
        text({
          en: `Enter the commission rate as a number from 0 to ${numberOf(most).en}, with up to 2 decimal places.`,
          ja: `歩合率は、0 から ${numberOf(most).ja} までの数で、小数第 2 位まで入力してください。`,
        }),
      /** The most bookings the API lets a member take at a time */
      maxConcurrentBookings: (most: number) =>
        text({
          en: `Enter the number of concurrent bookings as a whole number from 1 to ${numberOf(most).en}.`,
          ja: `同時に担当できる予約の数は、1 から ${numberOf(most).ja} までの整数で入力してください。`,
        }),
      /** The most minutes the API keeps before or after a booking */
      bufferTime: (most: number) =>
        text({
          en: `Enter whole minutes from 0 to ${numberOf(most).en}.`,
          ja: `0 から ${numberOf(most).ja} までの分を、整数で入力してください。`,
        }),
      emailTaken: text({
        en: 'A staff member with this email address is in the ledger already. Enter another email address.',
        ja: 'このメールアドレスのスタッフが、すでに台帳にいます。別のメールアドレスを入力してください。',
      }),
      staffCodeTaken: text({
        en: 'Another staff member uses this staff code (staff members removed from the ledger included). Enter another code.',
        ja: 'このスタッフコードは、ほかのスタッフが使っています（台帳から削除したスタッフも含みます）。別のコードを入力してください。',
      }),
      /** The member the account is linked to stays active */
      ownRecordStaysActive: text({
        en: 'Your own staff record cannot be made inactive: this account could no longer use the screens of the salon.',
        ja: 'ご自身のスタッフ情報は、無効にできません。無効にすると、このアカウントでサロンの画面を使えなくなります。',
      }),
    },
    /** The account does not keep the staff ledger of the salon */
    forbidden: text({
      en: 'This account cannot keep the staff ledger of this salon.',
      ja: 'このアカウントでは、このサロンのスタッフ台帳を扱えません。',
    }),
  },
  entry: {
    submit: text({ en: 'Register', ja: '登録する' }),
    done: (displayName: string) =>
      text({
        en: `Registered ${staffCalled(displayName).en} in the staff ledger.`,
        ja: `${staffCalled(displayName).ja}を、スタッフ台帳に登録しました。`,
      }),
    failed: text({
      en: 'Could not register the staff member. Check your connection and try again.',
      ja: 'スタッフを登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  change: {
    submit: text({ en: 'Save changes', ja: '変更を保存する' }),
    done: text({
      en: 'Saved the staff member.',
      ja: 'スタッフ情報を直しました。',
    }),
    failed: text({
      en: 'Could not save the staff member. Check your connection and try again.',
      ja: 'スタッフ情報を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  removal: {
    remove: text({ en: 'Remove', ja: '削除' }),
    title: (displayName: string) =>
      text({
        en: `Remove ${staffCalled(displayName).en} from the staff ledger?`,
        ja: `${staffCalled(displayName).ja}を、スタッフ台帳から削除しますか？`,
      }),
    description: text({
      en: 'A removed staff member cannot be restored. The bookings and treatment records they were assigned to stay. A linked sign-in account can no longer use the screens of the salon. The staff code cannot be used for another staff member. During a leave or while the staff member leaves the salon, make them inactive instead of removing them.',
      ja: '削除したスタッフは、元に戻せません。担当した予約や施術記録は残ります。紐づいたログインアカウントは、サロンの画面を使えなくなります。スタッフコードは、ほかのスタッフに使えないままです。休職や退職の手続きの間は、削除せずに無効にしてください。',
    }),
    back: uiMessages.back,
    submit: text({ en: 'Remove', ja: '削除する' }),
    done: (displayName: string) =>
      text({
        en: `Removed ${staffCalled(displayName).en} from the staff ledger.`,
        ja: `${staffCalled(displayName).ja}を、スタッフ台帳から削除しました。`,
      }),
    /** The member is assigned to bookings that are not finished */
    busy: (displayName: string) =>
      text({
        en: `${staffCalled(displayName).en} is assigned to bookings that are not finished (${UNFINISHED.en}), so they cannot be removed. Complete or cancel those bookings, or give them to another staff member by changing their date and time, then remove the staff member.`,
        ja: `${staffCalled(displayName).ja}は、終わっていない予約（${UNFINISHED.ja}）を担当しているため、削除できません。予約を完了するか、キャンセルするか、日時の変更で担当をほかのスタッフに替えてから、削除してください。`,
      }),
    /** The account no longer keeps the staff ledger of the salon */
    forbidden: followed(
      text({
        en: 'This account cannot remove staff members of this salon.',
        ja: 'このアカウントでは、このサロンのスタッフを削除できません。',
      }),
      STAFF_KEPT_BY,
    ),
    failed: text({
      en: 'Could not remove the staff member. Check your connection and try again.',
      ja: 'スタッフを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
}
