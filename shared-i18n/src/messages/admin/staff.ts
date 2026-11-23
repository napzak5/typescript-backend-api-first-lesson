import { text } from '../../languages/localized-text'

/**
 * What the admin application says of the members of the staff wherever a
 * screen names them: the bookings, the customers, the treatments, the
 * stock and the orders.
 */
export const adminStaffMessages = {
  /** A member the salon does not show any more (removed, or not working there now): one is named, though not by name */
  unlisted: text({ en: 'Staff member not listed', ja: '一覧にないスタッフ' }),
  /** A member by the name the salon shows them under, which stands as it was written in every language */
  named: (displayName: string) => text({ en: displayName, ja: displayName }),
}
