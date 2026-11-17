import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiBusinessHours,
  ApiOpeningHours,
  ApiSalonResponse,
  DbOpeningHours,
  DbSalon,
  SalonWithOpeningHours,
} from '../../models/salon'
import { storedBusinessHoursSchema } from '../../schemas/salon.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'

/**
 * Database rows → API response. Property names are the column names; what
 * changes is the representation of three kinds of column:
 * - `numeric` is read as a string and returned as a number
 * - `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601
 * - `jsonb` is untyped in the database and is checked against the API model
 */

const businessHoursSchema = z.array(storedBusinessHoursSchema).nullable()

const convertedColumnsSchema = z.object({
  latitude: numericSchema.nullable(),
  longitude: numericSchema.nullable(),
  rating: numericSchema.nullable(),
  taxRate: numericSchema,
  businessHours: businessHoursSchema,
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
  const { deletedAt, ...columns } = salon

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, salon, 'Invalid stored salon'),
      (converted) => ({
        ...columns,
        ...converted,
        openingHours: openingHours.map(toApiOpeningHours),
      }),
    ),
    (error) => storedDoesNotMatch(salon.id, error),
  )
}

/** The request was fine; the stored row is not. */
const storedDoesNotMatch = (id: string, cause: unknown): DomainError =>
  DomainErrors.database(
    `Stored salon ${id} does not match the API model`,
    cause,
  )

export const SalonReadMapper = {
  toApiSalon,

  /** The weekly hours of a salon alone, for what is worked out from them. */
  toBusinessHours({
    id,
    businessHours,
  }: Pick<DbSalon, 'id' | 'businessHours'>): Result<
    ApiBusinessHours[] | null,
    DomainError
  > {
    return Result.mapError(
      parseWith(businessHoursSchema, businessHours, 'Invalid stored salon'),
      (error) => storedDoesNotMatch(id, error),
    )
  },

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
