import { text } from '../../languages/localized-text'

/** What the API says of the share links. */
export const shareLinkMessages = {
  invalidShareLink: text({
    en: 'Invalid share link',
    ja: '共有リンクの内容が正しくありません',
  }),
  invalidShareLinkId: text({
    en: 'Invalid share link ID',
    ja: '共有リンクの ID が正しくありません',
  }),
  invalidShareLinkSearch: text({
    en: 'Invalid share link search',
    ja: '共有リンクの検索の条件が正しくありません',
  }),
  invalidSharedFileDownload: text({
    en: 'Invalid shared file download',
    ja: '共有されたファイルのダウンロードの指定が正しくありません',
  }),
  invalidSharedFileRequest: text({
    en: 'Invalid shared file request',
    ja: '共有されたファイルの指定が正しくありません',
  }),
  laterThanNow: text({
    en: 'Must be later than now',
    ja: '現在より後にしてください',
  }),
  aShareLinkOfAttachment: text({
    en: 'Must name a share link of the attachment',
    ja: 'この添付ファイルの共有リンクを指定してください',
  }),
  /** `days` is how long a link works at most. */
  withinDaysFromNow: (days: number) =>
    text({
      en: `Must be within ${days} days from now`,
      ja: `現在から ${days} 日以内にしてください`,
    }),
}
