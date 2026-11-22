import { text } from '../../languages/localized-text'

/** What the API says of the service categories. */
export const serviceCategoryMessages = {
  invalidServiceCategory: text({
    en: 'Invalid service category',
    ja: 'サービスのカテゴリーの内容が正しくありません',
  }),
  invalidServiceCategoryId: text({
    en: 'Invalid service category ID',
    ja: 'サービスのカテゴリーの ID が正しくありません',
  }),
  invalidServiceCategorySearch: text({
    en: 'Invalid service category search',
    ja: 'サービスのカテゴリーの検索の条件が正しくありません',
  }),
  invalidServiceCategoryUpdate: text({
    en: 'Invalid service category update',
    ja: 'サービスのカテゴリーの変更の内容が正しくありません',
  }),
  colour: text({
    en: 'Must be a colour in #RRGGBB format',
    ja: '#RRGGBB の形式の色にしてください',
  }),
}
