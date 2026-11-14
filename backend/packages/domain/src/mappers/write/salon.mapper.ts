import type {
  ApiOpeningHours,
  ApiSalonCreateRequest,
  ApiSalonUpdateRequest,
  DbNewOpeningHours,
  DbNewSalon,
  DbSalonChanges,
  OpeningHoursChange,
} from '../../models/salon'

/**
 * API request → database rows. Property names are the column names, so the
 * only conversion is the representation of `numeric` columns, which the
 * driver reads and writes as strings to keep their precision.
 */

const toNumeric = (value: number): string => String(value)

const toDbOpeningHours = (
  openingHours: ApiOpeningHours[],
): DbNewOpeningHours[] =>
  openingHours.map(
    ({
      dayOfWeek,
      date,
      openTime,
      closeTime,
      isHoliday,
      holidayName,
      notes,
    }) => ({
      dayOfWeek,
      date,
      openTime,
      closeTime,
      isHoliday,
      holidayName,
      notes,
    }),
  )

export const SalonWriteMapper = {
  fromCreateRequest(request: ApiSalonCreateRequest): {
    salon: DbNewSalon
    openingHours: DbNewOpeningHours[]
  } {
    const { openingHours, latitude, longitude, taxRate, ...columns } = request

    return {
      salon: {
        ...columns,
        latitude: latitude === null ? null : toNumeric(latitude),
        longitude: longitude === null ? null : toNumeric(longitude),
        taxRate: toNumeric(taxRate),
      },
      openingHours: toDbOpeningHours(openingHours),
    }
  },

  /** Only the properties present in the request become changes. */
  fromUpdateRequest(request: ApiSalonUpdateRequest): {
    changes: DbSalonChanges
    openingHours: OpeningHoursChange
  } {
    const { openingHours, latitude, longitude, taxRate, ...columns } = request

    return {
      changes: {
        ...columns,
        ...(latitude === undefined
          ? {}
          : { latitude: latitude === null ? null : toNumeric(latitude) }),
        ...(longitude === undefined
          ? {}
          : { longitude: longitude === null ? null : toNumeric(longitude) }),
        ...(taxRate === undefined ? {} : { taxRate: toNumeric(taxRate) }),
      },
      openingHours:
        openingHours === undefined
          ? { type: 'keep' }
          : { type: 'replace', openingHours: toDbOpeningHours(openingHours) },
    }
  },
}
