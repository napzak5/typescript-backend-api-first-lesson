import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiPage, Paging } from '../../models/page'
import type {
  ApiBusinessHours,
  ApiOpeningHours,
  ApiSalonResponse,
  DbOpeningHours,
  DbSalon,
  SalonId,
  SalonWithOpeningHours,
} from '../../models/salon'
import type { SalonList } from '../../repositories/salon.repository'
import { storedBusinessHoursSchema } from '../../schemas/salon.schema'
import { type DomainError, parseStored } from '../../shared'
import { numericSchema, timestampSchema } from './columns'
import { toApiPage } from './page'

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
}) satisfies z.ZodType<
  Pick<
    ApiSalonResponse,
    | 'latitude'
    | 'longitude'
    | 'rating'
    | 'taxRate'
    | 'businessHours'
    | 'createdAt'
    | 'updatedAt'
  >
>

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

  return Result.map(
    parseStored(convertedColumnsSchema, salon, storedSalon(salon.id)),
    (converted) => ({
      ...columns,
      ...converted,
      openingHours: openingHours.map(toApiOpeningHours),
    }),
  )
}

/** What is told of a stored salon that does not match, for the log. */
const storedSalon = (id: string): string =>
  `Stored salon ${id} does not match the API model`

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
    return parseStored(businessHoursSchema, businessHours, storedSalon(id))
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

  /** The salons of a list as a page of it. */
  toApiSalonPage(
    { salons, total, hasMore }: SalonList,
    paging: Paging<SalonId>,
  ): Result<ApiPage<ApiSalonResponse>, DomainError> {
    return Result.map(SalonReadMapper.toApiSalons(salons), (data) =>
      toApiPage(data, { total, hasMore }, paging),
    )
  },
}
