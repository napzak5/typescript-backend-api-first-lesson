import { text } from '../../languages/localized-text'

/** What the API says of the attachments. */
export const attachmentMessages = {
  invalidAttachment: text({
    en: 'Invalid attachment',
    ja: '添付ファイルの内容が正しくありません',
  }),
  invalidAttachmentId: text({
    en: 'Invalid attachment ID',
    ja: '添付ファイルの ID が正しくありません',
  }),
  invalidAttachmentDownload: text({
    en: 'Invalid attachment download',
    ja: '添付ファイルのダウンロードの指定が正しくありません',
  }),
  invalidAttachmentSearch: text({
    en: 'Invalid attachment search',
    ja: '添付ファイルの検索の条件が正しくありません',
  }),
  filenameWithoutPath: text({
    en: 'Must not contain a control character, / or \\',
    ja: '制御文字、/、\\ は使えません',
  }),
  /** `contentType` is the type of the file, as the request writes it. */
  filenameOfType: (contentType: string) =>
    text({
      en: `Must end as a file of the type ${contentType} does`,
      ja: `${contentType} のファイルの拡張子で終わらせてください`,
    }),
  anAttachmentOfList: text({
    en: 'Must name an attachment of the list',
    ja: 'この一覧の添付ファイルを指定してください',
  }),
}
