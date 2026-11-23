import { type LocalizedText, text } from '../../languages/localized-text'

const OPEN_THE_FILE = text({ en: 'Open the file', ja: 'ファイルを開く' })

const CANNOT_OPEN = text({
  en: 'This share link cannot be opened',
  ja: 'この共有リンクは開けません',
})

/**
 * What the screen of a share link says in the portal: the file a salon
 * shares with somebody who has no account, its password, and what became of
 * a load. The name of the file stands as the salon gave it.
 */
export const portalShareMessages = {
  title: text({ en: 'Shared file', ja: '共有されたファイル' }),
  checking: text({
    en: 'Checking the share link',
    ja: '共有リンクを確かめています',
  }),
  sharedBySalon: text({
    en: 'A file a salon shared with you.',
    ja: 'サロンから共有されたファイルです。',
  }),
  /** The link works no more, or the page has no token */
  cannotOpen: CANNOT_OPEN,
  /** Why a share link may work no more: the API does not say which */
  unusable: text({
    en: 'The link has expired, reached its limit of downloads, or been withdrawn, or the file was deleted. If you need the file, contact the salon that shared it.',
    ja: '有効期限が過ぎたか、ダウンロードの回数の上限に達したか、共有が取り消されたか、ファイルが削除されています。必要なときは、共有したサロンにお問い合わせください。',
  }),
  /** Said on a page that has no token: it was loaded again, or typed */
  noToken: text({
    en: 'Open this page from the share link you received. When you reload the page, open it from the link again too.',
    ja: 'このページは、受け取った共有リンクから開いてください。ページを読み込み直したときも、受け取ったリンクから、もう一度開いてください。',
  }),
  /** The form of the password of a link that has one */
  password: {
    label: text({ en: 'Password', ja: 'パスワード' }),
    description: text({
      en: 'This file is protected by a password. Enter the password the salon that shared it gave you apart from the link.',
      ja: 'このファイルは、パスワードで保護されています。共有したサロンから、リンクとは別に伝えられたパスワードを入力してください。',
    }),
    open: OPEN_THE_FILE,
    missing: text({
      en: 'Enter the password.',
      ja: 'パスワードを入力してください。',
    }),
    refused: text({
      en: 'The password is wrong, or it cannot be used for 15 minutes after 5 wrong attempts in a row. Check it and enter it again.',
      ja: 'パスワードが違うか、5 回続けて間違えたために、15 分のあいだ使えなくなっています。確かめて、もう一度入力してください。',
    }),
    /** Said when the password is asked for again, after the API refused the one that opened the file */
    again: text({
      en: 'Enter the password again. It may be unusable for a while after somebody else got it wrong several times.',
      ja: 'パスワードを、もう一度入力してください。ほかの人が続けて間違えたために、しばらく使えなくなっていることがあります。',
    }),
  },
  /** The record of the file */
  file: {
    title: text({ en: 'File', ja: 'ファイル' }),
    kind: text({ en: 'Type', ja: '種類' }),
    size: text({ en: 'Size', ja: 'サイズ' }),
    /** The size of a file in words, and in bytes when the words round it: 「340 KB（348,160 バイト）」 */
    sizeOf: (rounded: LocalizedText, bytes: LocalizedText) =>
      text({
        en: `${rounded.en} (${bytes.en})`,
        ja: `${rounded.ja}（${bytes.ja}）`,
      }),
    /** Said where the file is loaded: the link counts every load */
    loadNote: text({
      en: 'Every load of the file counts as one download. When the share link has a limit of downloads, one fewer is left. You can view and save the loaded file as often as you like while this page is open.',
      ja: 'ファイルを読み込むたびに、ダウンロードを 1 回と数えます。共有リンクにダウンロードの回数の上限があるときは、残りの回数が 1 回減ります。読み込んだファイルは、このページを開いているあいだ、何度でも見て、保存できます。',
    }),
    load: text({ en: 'Load the file', ja: 'ファイルを読み込む' }),
    /** The name of the links that open the file that was loaded */
    openings: OPEN_THE_FILE,
    inNewTab: text({ en: 'Open in a new tab', ja: '新しいタブで開く' }),
    save: text({ en: 'Save', ja: '保存する' }),
    notLoaded: text({
      en: 'The file could not be loaded. Check your connection and try again.',
      ja: 'ファイルを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    notFetched: text({
      en: 'The file could not be loaded. The download was counted. Loading it again counts as another.',
      ja: 'ファイルを読み込めませんでした。ダウンロードの回数は 1 回と数えられています。もう一度読み込むと、もう 1 回と数えます。',
    }),
  },
  /** The names that the sentences of other catalogues put in theirs (what was not read) */
  names: {
    file: text({ en: 'the information of the file', ja: 'ファイルの情報' }),
  },
}
