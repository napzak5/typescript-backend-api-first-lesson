import { text } from '../../languages/localized-text'

/** What the API says of the points. */
export const pointMessages = {
  invalidExpiringPointsSearch: text({
    en: 'Invalid expiring points search',
    ja: '失効が近いポイントの検索の条件が正しくありません',
  }),
  invalidPointTransactionSearch: text({
    en: 'Invalid point transaction search',
    ja: 'ポイントの履歴の検索の条件が正しくありません',
  }),
  invalidPointAdjustment: text({
    en: 'Invalid point adjustment',
    ja: 'ポイントの調整の内容が正しくありません',
  }),
  invalidPointEarning: text({
    en: 'Invalid point earning',
    ja: 'ポイントの付与の内容が正しくありません',
  }),
  invalidPointExpiry: text({
    en: 'Invalid point expiry',
    ja: 'ポイントの失効の内容が正しくありません',
  }),
  invalidPointUse: text({
    en: 'Invalid point use',
    ja: 'ポイントの利用の内容が正しくありません',
  }),
}
