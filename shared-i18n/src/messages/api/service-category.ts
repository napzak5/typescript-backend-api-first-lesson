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
  notItselfOrSubcategory: text({
    en: 'Must not be the category itself or one of its subcategories',
    ja: 'そのカテゴリー自身と、その下のカテゴリーにはできません',
  }),
  categoryOfCursorGone: text({
    en: 'The category this cursor names is not there any more',
    ja: 'このカーソルが指すカテゴリーは、もうありません',
  }),
}
