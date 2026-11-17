import { addDays, format, isValid } from 'date-fns'
import { inTimeZone } from '../../../schemas/rules'

/**
 * How many days after today a stock row counts as expiring soon: the
 * default of the list of what expires and the window of the alerts.
 */
export const EXPIRING_SOON_DAYS = 30

/**
 * The last expiry date that counts as expiring soon at a salon: the day
 * that is `days` days after today, as the salon's clocks tell today. Null
 * when the runtime does not know the time zone of the salon.
 */
export const lastExpiringDayOf = (
  now: Date,
  timezone: string,
  days: number,
): string | null => {
  const today = inTimeZone(now, timezone)

  return isValid(today) ? format(addDays(today, days), 'yyyy-MM-dd') : null
}
