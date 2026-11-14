import { Result } from '@beauty-salon-backend/utility'
import { parseISO } from 'date-fns'
import { z } from 'zod'
import type {
  ApiOpeningHours,
  ApiSalonResponse,
  DbOpeningHours,
  DbSalon,
  SalonWithOpeningHours,
} from '../../models/salon'
import { storedBusinessHoursSchema } from '../../schemas/salon.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'

/**
 * Database rows → API response. Property names are the column names; what
 * changes is the representation of three kinds of column:
 * - `numeric` is read as a string and returned as a number
 * - `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601
 * - `jsonb` is untyped in the database and is checked against the API model
 */

const numericSchema = z.string().transform(Number).pipe(z.number())

const timestampSchema = z
  .string()
  .transform((value) => parseISO(value))
  .pipe(z.date())
  .transform((value) => value.toISOString())

const convertedColumnsSchema = z.object({
  latitude: numericSchema.nullable(),
  longitude: numericSchema.nullable(),
  rating: numericSchema.nullable(),
  taxRate: numericSchema,
  businessHours: z.array(storedBusinessHoursSchema).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const toApiOpeningHours = ({
  dayOfWeek,
  date,
  openTime,
  closeTime,
  isHoliday,
  holidayName,
  notes,
}: DbOpeningHours): ApiOpeningHours => ({
  dayOfWeek,
  date,
  openTime,
  closeTime,
  isHoliday,
  holidayName,
  notes,
})

const toApiSalon = (
  salon: DbSalon,
  openingHours: DbOpeningHours[],
): Result<ApiSalonResponse, DomainError> => {
  const { deletedAt, cancellationPolicy, bookingPolicy, ...columns } = salon

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, salon, 'Invalid stored salon'),
      (converted) => ({
        ...columns,
        ...converted,
        openingHours: openingHours.map(toApiOpeningHours),
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored salon ${salon.id} does not match the API model`,
        error,
      ),
  )
}

export const SalonReadMapper = {
  toApiSalon,

  toApiSalons(
    salons: SalonWithOpeningHours[],
  ): Result<ApiSalonResponse[], DomainError> {
    const apiSalons: ApiSalonResponse[] = []
    for (const { salon, openingHours } of salons) {
      const mapped = toApiSalon(salon, openingHours)
      if (mapped.type === 'error') {
        return mapped
      }
      apiSalons.push(mapped.data)
    }
    return Result.success(apiSalons)
  },
}
