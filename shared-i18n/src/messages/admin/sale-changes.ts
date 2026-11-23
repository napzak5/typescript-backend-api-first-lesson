import { type LocalizedText, text } from '../../languages/localized-text'
import { followed } from '../written'
import { SALE_WORDS, UNDONE_BY_OTHERS } from './sale-words'

/*
 * What a sale says in the admin application after it was entered: the
 * form that changes what it records beside what it bills, the voiding of
 * a sale, and what is said of the answers. The names of the staff, the
 * notes and the reasons stand as they were written.
 */

const VOID_REASON_MISSING = text({
  en: 'Enter the reason for voiding.',
  ja: '取り消しの理由を入力してください。',
})

export const saleChangeMessages = {
  change: {
    title: text({ en: 'Edit the sale', ja: '売上を直す' }),
    submit: text({ en: 'Save the changes', ja: '変更を保存する' }),
    /** What the screen says above the form of what it does not change */
    notHere: text({
      en: 'The line items and the amounts are not edited here. When they are wrong, an owner or a manager refunds the payments in full, voids the sale and checks the booking out again.',
      ja: '明細と金額は、ここでは直せません。誤りがあるときは、オーナーかマネージャーが、支払いを全額返金して売上を取り消し、予約から会計を入れ直します。',
    }),
    /** The member of the sale, who is not among the staff now */
    unlisted: text({
      en: 'Staff member not listed (the cashier now)',
      ja: '一覧にないスタッフ（いまの担当）',
    }),
    cashierDescription: text({
      en: 'The staff member who took the payment.',
      ja: '支払いを受けたスタッフです。',
    }),
    saleDateDescription: text({
      en: 'The date on the clock of the salon. The sales ledger finds the sale by this date.',
      ja: 'サロンの時計の日付です。売上台帳は、この日で売上を探します。',
    }),
    saleTime: text({ en: 'Time of the sale', ja: '会計の時刻' }),
    saleTimeDescription: text({
      en: 'When the payment was taken. It cannot be later than now.',
      ja: '支払いを受けた時刻です。いまより後にはできません。',
    }),
    notesDescription: followed(
      SALE_WORDS.notesDescription,
      text({
        en: 'Leave it empty to remove the note.',
        ja: '空にすると、メモを消します。',
      }),
    ),
    /** Why a sale is not changed */
    voided: text({
      en: 'A voided sale cannot be edited. It stays as a record of the voiding.',
      ja: '取り消した売上は、直せません。取り消しの記録として残ります。',
    }),
    errors: {
      saleDate: text({
        en: 'Enter the date of the sale.',
        ja: '会計日を入力してください。',
      }),
      saleTime: text({
        en: 'Enter the time of the sale.',
        ja: '会計の時刻を入力してください。',
      }),
      later: text({
        en: 'The time of the sale must be before now.',
        ja: '会計日時は、いまより前にしてください。',
      }),
      staffGone: text({
        en: 'This staff member was removed meanwhile and cannot be chosen. Choose again.',
        ja: 'このスタッフは、その間に削除されたため、選べません。選び直してください。',
      }),
    },
    undated: text({
      en: 'The time zone of the salon is not valid, so the date of the sale could not be set and its time was not changed. Correct the settings of the salon.',
      ja: 'サロンのタイムゾーンが正しくないため、会計日を決められず、会計日時を直せませんでした。サロンの設定を直してください。',
    }),
    forbidden: text({
      en: 'This account cannot edit this sale.',
      ja: 'このアカウントでは、この売上を直せません。',
    }),
    failed: text({
      en: 'The sale could not be saved. Check your connection and try again.',
      ja: '売上を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    done: text({ en: 'Saved the sale.', ja: '売上を直しました。' }),
  },
  void: {
    title: text({ en: 'Voiding', ja: '取り消し' }),
    explanation: text({
      en: 'Void a sale that was entered by mistake, or one whose payments were refunded in full to be paid again.',
      ja: '誤って入れた売上や、支払いを全額返金して払い直す売上を、取り消します。',
    }),
    open: text({ en: 'Void the sale', ja: '売上を取り消す' }),
    confirm: text({ en: 'Void the sale?', ja: '売上を取り消しますか？' }),
    /** What the dialog says of the sale it voids, named by its number */
    description: (sale: LocalizedText) =>
      text({
        en: `${sale.en} will be voided. A voided sale stays in the sales ledger as a record of the voiding, and can be neither edited nor paid. The booking can be checked out again. Voiding cannot be undone.`,
        ja: `${sale.ja}を取り消します。取り消した売上は、取り消しの記録として売上台帳に残り、直すことも支払いを受けることもできません。予約の会計は、入れ直せます。取り消しは、元に戻せません。`,
      }),
    submit: text({ en: 'Void', ja: '取り消す' }),
    reason: text({ en: 'Reason for voiding', ja: '取り消しの理由' }),
    reasonDescription: text({
      en: 'Kept with the voided sale. Write it so that whoever reads it later understands.',
      ja: '取り消した売上に残ります。あとで見る人に分かるように書きます。',
    }),
    reasonMissing: VOID_REASON_MISSING,
    /** Why a sale is not voided */
    why: {
      voided: text({
        en: 'This sale was voided.',
        ja: 'この売上は、取り消されています。',
      }),
      partlyRefunded: text({
        en: 'A payment of this sale was partly refunded, so the sale cannot be voided. A payment is refunded once, so the rest cannot be refunded.',
        ja: '一部を返金した支払いがあるため、この売上は取り消せません。1 件の支払いの返金は 1 回で、残りは返金できません。',
      }),
      received: text({
        en: 'This sale has payments that were received, so it cannot be voided as it is. Refund every payment in full first.',
        ja: '受け取った支払いがあるため、このままでは取り消せません。取り消す前に、支払いをすべて全額返金してください。',
      }),
    },
    voidedMeanwhile: text({
      en: 'This sale was voided meanwhile.',
      ja: 'この売上は、その間に取り消されていました。',
    }),
    /** The payments changed meanwhile, and why the sale is not voided now */
    paymentsChanged: (why: LocalizedText) =>
      followed(
        text({
          en: 'The payments of this sale changed meanwhile.',
          ja: 'その間に、この売上の支払いが変わりました。',
        }),
        why,
      ),
    forbidden: followed(
      text({
        en: 'This account cannot void sales.',
        ja: 'このアカウントでは、売上を取り消せません。',
      }),
      UNDONE_BY_OTHERS,
    ),
    failed: text({
      en: 'The sale could not be voided. Check your connection and try again.',
      ja: '売上を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    done: text({ en: 'Voided the sale.', ja: '売上を取り消しました。' }),
    doneOfBooking: text({
      en: 'Voided the sale. The booking can be checked out again.',
      ja: '売上を取り消しました。予約の会計を、入れ直せます。',
    }),
  },
}
