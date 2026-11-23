import { text } from '../../languages/localized-text'

/** What the API says of the available slots. */
export const availableSlotMessages = {
  invalidAvailableSlotCheck: text({
    en: 'Invalid available slot check',
    ja: '空き枠の確認の内容が正しくありません',
  }),
  invalidAvailableSlotSearch: text({
    en: 'Invalid available slot search',
    ja: '空き枠の検索の条件が正しくありません',
  }),
  cursorOfAPage: text({
    en: 'Must be the nextCursor of a page of available slots',
    ja: '空き枠のページの nextCursor にしてください',
  }),
}
