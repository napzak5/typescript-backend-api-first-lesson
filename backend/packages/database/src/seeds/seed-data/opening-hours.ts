import { type Day, format, nextDay } from 'date-fns'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'

export async function seedOpeningHours(
  db: PostgresJsDatabase<typeof schema>,
  salonIds: string[],
): Promise<string[]> {
  const openingHours = []
  const daysOfWeek = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ] as const

  const dayIndexes: Record<(typeof daysOfWeek)[number], Day> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }

  // The next date that falls on the given day, as a local calendar date so
  // that it agrees with dayOfWeek whatever the time of day.
  const getNextOccurrence = (dayOfWeek: (typeof daysOfWeek)[number]): string =>
    format(nextDay(new Date(), dayIndexes[dayOfWeek]), 'yyyy-MM-dd')

  for (const salonId of salonIds) {
    // Regular weekday hours
    for (const day of daysOfWeek.slice(0, 5)) {
      // Monday to Friday
      openingHours.push({
        salonId,
        dayOfWeek: day,
        date: getNextOccurrence(day),
        openTime: '10:00:00',
        closeTime: '20:00:00',
        isHoliday: false,
      })
    }

    // Saturday hours
    openingHours.push({
      salonId,
      dayOfWeek: 'saturday' as const,
      date: getNextOccurrence('saturday'),
      openTime: '09:00:00',
      closeTime: '19:00:00',
      isHoliday: false,
    })

    // Sunday hours
    openingHours.push({
      salonId,
      dayOfWeek: 'sunday' as const,
      date: getNextOccurrence('sunday'),
      openTime: '09:00:00',
      closeTime: '18:00:00',
      isHoliday: false,
    })

    // Add some specific date overrides (holidays)
    openingHours.push(
      {
        salonId,
        dayOfWeek: 'monday' as const, // New Year's Day 2024 was Monday
        date: '2024-01-01',
        isHoliday: true,
        holidayName: "New Year's Day",
        notes: 'Closed for New Year holiday',
      },
      {
        salonId,
        dayOfWeek: 'friday' as const, // Constitution Memorial Day 2024 was Friday
        date: '2024-05-03',
        isHoliday: true,
        holidayName: 'Constitution Memorial Day',
        notes: 'National holiday',
      },
      {
        salonId,
        dayOfWeek: 'tuesday' as const, // New Year's Eve 2024 is Tuesday
        date: '2024-12-31',
        openTime: '10:00:00',
        closeTime: '17:00:00',
        isHoliday: false,
        notes: "Early closing for New Year's Eve",
      },
    )
  }

  const hours = await db
    .insert(schema.openingHours)
    .values(openingHours)
    .returning({ id: schema.openingHours.id })

  return hours.map((h) => h.id)
}
