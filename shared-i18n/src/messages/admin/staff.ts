import { text } from '../../languages/localized-text'

/**
 * What the admin application says of the members of the staff wherever a
 * screen names them: the bookings, the sales, the customers, the
 * treatments, the stock and the orders.
 */
export const adminStaffMessages = {
  /** A member the salon does not show any more (removed, or not working there now): one is named, though not by name */
  unlisted: text({ en: 'Staff member not listed', ja: '一覧にないスタッフ' }),
  /** Nobody is recorded for a line of a booking or of a sale: it takes nobody's time */
  unassigned: text({ en: 'Unassigned', ja: '未定' }),
  /** A member by the name the salon shows them under, which stands as it was written in every language */
  named: (displayName: string) => text({ en: displayName, ja: displayName }),
}
