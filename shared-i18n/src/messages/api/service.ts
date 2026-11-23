import { text } from '../../languages/localized-text'

/** What the API says of the services. */
export const serviceMessages = {
  invalidService: text({
    en: 'Invalid service',
    ja: 'サービスの内容が正しくありません',
  }),
  invalidServiceId: text({
    en: 'Invalid service ID',
    ja: 'サービスの ID が正しくありません',
  }),
  invalidServiceSearch: text({
    en: 'Invalid service search',
    ja: 'サービスの検索の条件が正しくありません',
  }),
  invalidServiceBulkUpdate: text({
    en: 'Invalid service bulk update',
    ja: 'サービスの一括の変更の内容が正しくありません',
  }),
  invalidServiceUpdate: text({
    en: 'Invalid service update',
    ja: 'サービスの変更の内容が正しくありません',
  }),
}
