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
}
