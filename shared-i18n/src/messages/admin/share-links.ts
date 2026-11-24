import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { countOf, followed } from '../written'

/*
 * What the admin application says of the share links of the files of a
 * salon: who shares a file, the form of an issue and what is wrong with
 * its values, the link that was issued, the links of a file with the state
 * of each, and a link revoked. The names of the files, the addresses of the
 * links and the names of the members of the staff stand as they were
 * written.
 */

/** Who shares a file, said to a role that does not */
const SHARERS = text({
  en: 'Only the owners and managers of the salon and administrators can issue and revoke the share links of files.',
  ja: 'ファイルの共有リンクを発行し、取り消せるのは、サロンのオーナー、マネージャー、管理者です。',
})

const ISSUE = text({ en: 'Issue a share link', ja: '共有リンクを発行する' })
const SHARE_LINK = text({ en: 'Share link', ja: '共有リンク' })
const EXPIRES_AT = text({ en: 'Expires', ja: '有効期限' })
const LIMIT = text({ en: 'Download limit', ja: 'ダウンロードの回数の上限' })
const PASSWORD = text({ en: 'Password', ja: 'パスワード' })
const NO_LIMIT = text({ en: 'No limit', ja: '上限なし' })

/** How often a file was given, or may be: 「3 回」 */
const timesOf = (count: number): LocalizedText =>
  countOf(count, 'time', 'times', '回')

export const adminShareLinkMessages = {
  titles: {
    entry: ISSUE,
    shareLink: SHARE_LINK,
  },
  /** What a screen could not read, as a sentence names it */
  names: {
    shareLink: text({ en: 'the share link', ja: '共有リンク' }),
    shareLinks: text({ en: 'the share links', ja: '共有リンク' }),
  },
  loading: {
    shareLink: text({
      en: 'Loading the share link',
      ja: '共有リンクを読み込んでいます',
    }),
    shareLinks: text({
      en: 'Loading the share links',
      ja: '共有リンクを読み込んでいます',
    }),
  },
  sharers: SHARERS,
  /** What a screen of the share links says to a role that shares no file */
  forbidden: followed(
    text({
      en: 'This account cannot share files.',
      ja: 'このアカウントでは、ファイルを共有できません。',
    }),
    SHARERS,
  ),
  toFile: text({ en: 'Back to the file', ja: 'ファイルへ戻る' }),
  /** The file of a link with its salon, said below the heading of the link */
  fileOfSalon: (filename: string, salonName: string) =>
    text({
      en: `${filename} (${salonName})`,
      ja: `${filename}（${salonName}）`,
    }),
  /** Said of a file whose upload was not finished */
  notUploaded: text({
    en: 'A file whose upload is not finished cannot be shared. Issue a share link once the upload is finished.',
    ja: 'アップロードが済んでいないファイルは、共有できません。アップロードが済んでから、共有リンクを発行してください。',
  }),
  /** What a share link is, said above the links of a file */
  about: text({
    en: 'A link that shows this file to people who have no account (customers, business partners). Until it expires, whoever knows the link can download the file.',
    ja: 'アカウントを持たない人（お客様、取引先）に、このファイルを見せるリンクです。期限まで、リンクを知っている人がファイルを読み込めます。',
  }),
  /** The form of an issue */
  form: {
    submit: ISSUE,
    cancel: text({ en: 'Cancel', ja: 'やめる' }),
    intro: (filename: string) =>
      text({
        en: `Issues a link that shows “${filename}” to people who have no account.`,
        ja: `「${filename}」を、アカウントを持たない人に見せるリンクを発行します。`,
      }),
    period: text({ en: 'Valid for', ja: '有効期間' }),
    periodDescription: text({
      en: 'Counted from the time the link is issued. Once it expires, the link no longer works.',
      ja: '発行した時刻から数えます。期限を過ぎると、リンクは使えなくなります。',
    }),
    /** A period the form offers: 「7 日」 */
    daysOf: (days: number): LocalizedText => countOf(days, 'day', 'days', '日'),
    limit: LIMIT,
    limitDescription: text({
      en: 'How many times the file can be downloaded from the link. Left empty, there is no limit.',
      ja: 'リンクからファイルを読み込める回数です。空のままなら、上限はありません。',
    }),
    password: PASSWORD,
    passwordDescription: text({
      en: 'From 8 to 128 characters. Left empty, the file is shared without a password. Tell the password in another way than the link.',
      ja: '8 文字から 128 文字。空のままなら、パスワードなしで共有します。パスワードは、リンクとは別の方法で伝えてください。',
    }),
    errors: {
      periodMissing: text({
        en: 'Choose how long the link is valid for.',
        ja: '有効期間を選んでください。',
      }),
      limit: (most: LocalizedText) =>
        text({
          en: `Enter the download limit as a whole number from 1 to ${most.en}. Leave it empty for no limit.`,
          ja: `回数の上限は、1 から ${most.ja} までの整数で入力してください。上限を付けないときは、空のままにしてください。`,
        }),
      passwordLength: text({
        en: 'Enter a password of 8 to 128 characters. Leave it empty for no password.',
        ja: 'パスワードは、8 文字から 128 文字で入力してください。パスワードを付けないときは、空のままにしてください。',
      }),
      passwordGuessed: text({
        en: 'This password is easy to guess. Sequences, rows of the keyboard, repeated characters and common passwords cannot be used. Choose another password.',
        ja: '推測されやすいパスワードです。連番、キーボードの並び、同じ文字の繰り返し、よく使われるパスワードは使えません。ほかのパスワードにしてください。',
      }),
      expiryRefused: text({
        en: 'Could not set the expiry. Check that the clock of this device is right, and issue the link again.',
        ja: '有効期限を決められませんでした。この端末の時計が正しいか確かめて、もう一度発行してください。',
      }),
    },
    /** What the form says to a role that shares no file, after the API refused it */
    forbidden: followed(
      text({
        en: 'This account cannot share this file.',
        ja: 'このアカウントでは、このファイルを共有できません。',
      }),
      SHARERS,
    ),
    failed: text({
      en: 'Could not issue the share link. Check your connection and try again.',
      ja: '共有リンクを発行できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The link that was issued, shown once */
  issued: {
    title: text({ en: 'Issued share link', ja: '発行した共有リンク' }),
    link: SHARE_LINK,
    linkDescription: text({
      en: 'Give this address to the person to show the file to.',
      ja: 'このアドレスを、ファイルを見せる相手に伝えてください。',
    }),
    copy: text({ en: 'Copy the link', ja: 'リンクをコピーする' }),
    copied: text({ en: 'Copied the link.', ja: 'リンクをコピーしました。' }),
    copyFailed: text({
      en: 'Could not copy the link. Select the address in the field above, and copy it.',
      ja: 'リンクをコピーできませんでした。上の欄のアドレスを選んで、コピーしてください。',
    }),
    /** Said where the link that was issued is shown: it is in that answer alone */
    onlyNow: text({
      en: 'This link is shown now only. Once you leave this screen, it cannot be shown again. If it is lost, revoke this share link and issue another.',
      ja: 'このリンクは、いまだけ表示します。この画面を離れると、もう表示できません。なくしたときは、この共有リンクを取り消して、発行し直してください。',
    }),
    /** Said beside a link that has a password */
    passwordApart: text({
      en: 'Tell the password in another way than the link (by phone, in person and the like).',
      ja: 'パスワードは、リンクとは別の方法（電話や、会ったときなど）で伝えてください。',
    }),
    expiresAt: EXPIRES_AT,
    limit: LIMIT,
    password: PASSWORD,
    toShareLink: text({ en: 'See the share link', ja: '共有リンクを見る' }),
  },
  /** The links of a file */
  list: {
    title: text({ en: 'Share links', ja: '共有リンク' }),
    issue: ISSUE,
    none: text({ en: 'No share links', ja: '共有リンクはありません' }),
    noneDescription: text({
      en: `With “${ISSUE.en}”, a link is issued with how long it is valid for, a download limit and a password.`,
      ja: `「${ISSUE.ja}」から、有効期間、ダウンロードの回数の上限、パスワードを決めて発行できます。`,
    }),
    caption: text({ en: 'Issued share links', ja: '発行した共有リンク' }),
    createdAt: text({ en: 'Issued', ja: '発行日時' }),
    expiresAt: EXPIRES_AT,
    downloads: text({ en: 'Downloads', ja: 'ダウンロード' }),
    password: PASSWORD,
    state: text({ en: 'Status', ja: '状態' }),
  },
  /** Whether a link still opens its file */
  states: {
    usable: text({ en: 'Usable', ja: '使える' }),
    expired: text({ en: 'Expired', ja: '期限切れ' }),
    usedUp: text({ en: 'Download limit reached', ja: '回数の上限に達した' }),
  },
  /** How a link is shown */
  values: {
    noLimit: NO_LIMIT,
    timesOf,
    /** How often a link gave its file, against its limit: 「1 回（上限 3 回）」, 「2 回（上限なし）」 */
    downloadsOf: (count: number, most: number | null) =>
      most === null
        ? text({
            en: `${timesOf(count).en} (no limit)`,
            ja: `${timesOf(count).ja}（${NO_LIMIT.ja}）`,
          })
        : text({
            en: `${timesOf(count).en} (limit: ${timesOf(most).en})`,
            ja: `${timesOf(count).ja}（上限 ${timesOf(most).ja}）`,
          }),
    hasPassword: text({ en: 'Set', ja: 'あり' }),
  },
  /** A link, with its revocation after a dialog */
  record: {
    title: SHARE_LINK,
    state: text({ en: 'Status', ja: '状態' }),
    expiresAt: EXPIRES_AT,
    downloads: text({ en: 'Downloads', ja: 'ダウンロード' }),
    password: PASSWORD,
    issuer: text({ en: 'Issued by', ja: '発行した人' }),
    createdAt: text({ en: 'Issued', ja: '発行日時' }),
    addressShownOnce: text({
      en: 'The address of the link was shown only when it was issued. If it is lost, revoke this share link and issue another.',
      ja: 'リンクのアドレスは、発行したときにだけ表示しました。なくしたときは、この共有リンクを取り消して、発行し直してください。',
    }),
  },
  revocation: {
    button: text({ en: 'Revoke the share link', ja: '共有リンクを取り消す' }),
    title: text({
      en: 'Revoke the share link?',
      ja: '共有リンクを取り消しますか？',
    }),
    description: text({
      en: 'The link stops working at once. A revoked share link cannot be restored.',
      ja: 'このリンクは、すぐに使えなくなります。取り消した共有リンクは、元に戻せません。',
    }),
    back: uiMessages.back,
    confirm: text({ en: 'Revoke', ja: '取り消す' }),
    done: text({
      en: 'Revoked the share link.',
      ja: '共有リンクを取り消しました。',
    }),
    forbidden: followed(
      text({
        en: 'This account cannot revoke this share link.',
        ja: 'このアカウントでは、この共有リンクを取り消せません。',
      }),
      SHARERS,
    ),
    failed: text({
      en: 'Could not revoke the share link. Check your connection and try again.',
      ja: '共有リンクを取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The screen of a link when there is none to show */
  notFound: {
    title: text({
      en: 'Share link not found',
      ja: '共有リンクが見つかりません',
    }),
    description: text({
      en: 'A revoked share link cannot be shown. Check that the address is correct.',
      ja: '取り消した共有リンクは、表示できません。アドレスが正しいか、お確かめください。',
    }),
  },
}
