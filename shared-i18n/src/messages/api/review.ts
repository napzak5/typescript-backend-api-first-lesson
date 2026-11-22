import { text } from '../../languages/localized-text'

/** What the API says of the reviews. */
export const reviewMessages = {
  invalidReview: text({
    en: 'Invalid review',
    ja: 'レビューの内容が正しくありません',
  }),
  invalidReviewId: text({
    en: 'Invalid review ID',
    ja: 'レビューの ID が正しくありません',
  }),
  invalidReviewSearch: text({
    en: 'Invalid review search',
    ja: 'レビューの検索の条件が正しくありません',
  }),
  invalidReviewResponse: text({
    en: 'Invalid review response',
    ja: 'レビューへの返信の内容が正しくありません',
  }),
  invalidReviewUpdate: text({
    en: 'Invalid review update',
    ja: 'レビューの変更の内容が正しくありません',
  }),
  nullWithoutStaff: text({
    en: 'Must be null when staffId is null',
    ja: 'staffId が null のときは、null にしてください',
  }),
  notGreaterThanMaxRating: text({
    en: 'Must not be greater than maxRating',
    ja: 'maxRating より大きくはできません',
  }),
}
