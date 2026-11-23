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
  nullWithoutStaffMember: text({
    en: 'Must be null when the review names no staff member',
    ja: 'レビューにスタッフがないときは、null にしてください',
  }),
  aBookingOfCustomer: text({
    en: 'Must name a booking of the customer',
    ja: 'この顧客の予約を指定してください',
  }),
  aListedReview: text({
    en: 'Must name a review that is listed',
    ja: '一覧にあるレビューを指定してください',
  }),
  theSalonOfBooking: text({
    en: 'Must name the salon of the booking',
    ja: '予約のサロンを指定してください',
  }),
  aStaffMemberWhoTookBooking: text({
    en: 'Must name a staff member who took the booking',
    ja: '予約を担当したスタッフを指定してください',
  }),
}
