import { text } from '../../languages/localized-text'

/** What the API says of the products. */
export const productMessages = {
  invalidProduct: text({
    en: 'Invalid product',
    ja: '商品の内容が正しくありません',
  }),
  invalidProductId: text({
    en: 'Invalid product ID',
    ja: '商品の ID が正しくありません',
  }),
  invalidProductSearch: text({
    en: 'Invalid product search',
    ja: '商品の検索の条件が正しくありません',
  }),
  invalidProductUpdate: text({
    en: 'Invalid product update',
    ja: '商品の変更の内容が正しくありません',
  }),
}
