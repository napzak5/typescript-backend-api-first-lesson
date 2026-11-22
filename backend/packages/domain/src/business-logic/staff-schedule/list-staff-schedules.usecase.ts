import { Result } from '@beauty-salon-backend/utility'
import { StaffScheduleReadMapper } from '../../mappers/read/staff-schedule.mapper'
import { StaffScheduleWriteMapper } from '../../mappers/write/staff-schedule.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { parseStaffId } from '../../models/staff'
import type { ApiStaffSchedule } from '../../models/staff-schedule'
import { staffScheduleSearchRequestSchema } from '../../schemas/staff-schedule.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { scheduleOn } from './_shared/applicable-schedule'
import { mayReadScheduleOf, mayReadSchedules } from './_shared/authorization'
import type { StaffScheduleUseCaseDependencies } from './_shared/dependencies'

export class ListStaffSchedulesUseCase {
  constructor(
    private readonly dependencies: StaffScheduleUseCaseDependencies,
  ) {}

  /**
   * Reads the schedule of a staff member: all its rows, or, for a date,
   * the one row that applies on it, if any. Whether the actor may is
   * decided from the path alone, before the query is read and before
   * anything is looked up: first from the salon, then, for a staff member
   * of the salon, from whose schedule it is. A staff member of another
   * salon, and a deleted one, are not found.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
    query: unknown,
  ): Promise<Result<ApiStaffSchedule[], DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayReadSchedules(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    const staffId = parseStaffId(id)
    if (staffId.type === 'error') {
      return staffId
    }
    if (!mayReadScheduleOf(actor, staffId.data)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(
      staffScheduleSearchRequestSchema,
      query,
      'Invalid staff schedule search',
    )
    if (request.type === 'error') {
      return request
    }
    const { date } = StaffScheduleWriteMapper.fromSearchRequest(request.data)

    const { staffScheduleRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const found = await staffScheduleRepository.findByStaff(
      salonId.data,
      staffId.data,
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.notFound('Staff member', staffId.data))
    }

    if (date === null) {
      return Result.success(
        found.data.map(StaffScheduleReadMapper.toApiStaffSchedule),
      )
    }

    const applicable = scheduleOn(found.data, date)

    return Result.success(
      applicable === null
        ? []
        : [StaffScheduleReadMapper.toApiStaffSchedule(applicable)],
    )
  }
}
