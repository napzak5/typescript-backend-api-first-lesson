import { parseISO } from 'date-fns'
import type { CalendarDay } from '../../../models/available-slot'
import type { ApiBusinessHours } from '../../../models/salon'
import { dayOfWeekOf } from '../../../schemas/rules'
import { momentAt } from './salon-time'
import { joined, overlapOf, type TimeRange, without } from './time-ranges'

/** The hours of a salon, as far as they say when it is open. */
export type HoursOfSalon = {
  timezone: string
  /** The weekly hours; null for a salon that has not said any. */
  businessHours: readonly ApiBusinessHours[] | null
}

/**
 * When a salon is open on a date (`YYYY-MM-DD`).
 *
 * The row of its calendar for that date decides alone when there is one:
 * the salon is open between its two times, and closed all day when it has
 * none. A day that is marked as a holiday and has times is a holiday on
 * which the salon is open.
 *
 * Without such a row the weekly hours of that day of the week decide: the
 * operating slots without the breaks, and within the period the entry is
 * for when it has one. A salon that has said nothing about the day is
 * closed.
 */
export const openRangesOf = (
  salon: HoursOfSalon,
  calendarDay: CalendarDay | null,
  date: string,
): TimeRange[] => {
  const at = (time: string): Date => momentAt(date, time, salon.timezone)
  const rangeOf = (slot: { startTime: string; endTime: string }) => ({
    from: at(slot.startTime),
    until: at(slot.endTime),
  })

  if (calendarDay !== null) {
    const { openTime, closeTime } = calendarDay

    return openTime === null || closeTime === null
      ? []
      : joined([{ from: at(openTime), until: at(closeTime) }])
  }

  const dayOfWeek = dayOfWeekOf(date)
  const weekly = (salon.businessHours ?? []).find(
    (hours) => hours.dayOfWeek === dayOfWeek,
  )
  if (weekly === undefined || weekly.isClosed) {
    return []
  }

  const open = without(
    weekly.operatingSlots.map(rangeOf),
    (weekly.breakSlots ?? []).map(rangeOf),
  )

  return weekly.effectivePeriod === null
    ? open
    : overlapOf(open, [
        {
          from: parseISO(weekly.effectivePeriod.startDate),
          until: parseISO(weekly.effectivePeriod.endDate),
        },
      ])
}
