import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  staffScheduleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { StaffScheduleReadMapper } from '../../mappers/read/staff-schedule.mapper'
import { StaffScheduleWriteMapper } from '../../mappers/write/staff-schedule.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { parseStaffId } from '../../models/staff'
import type { ApiStaffSchedule } from '../../models/staff-schedule'
import { staffScheduleUpdateRequestSchema } from '../../schemas/staff-schedule.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayPlanSchedules } from './_shared/authorization'
import type { StaffScheduleUseCaseDependencies } from './_shared/dependencies'

export class UpdateStaffSchedulesUseCase {
  constructor(
    private readonly dependencies: StaffScheduleUseCaseDependencies,
  ) {}

  /**
   * Puts the entries of the request in the place of the whole schedule of
   * a staff member; an empty list leaves the staff member without one.
   * Unlike the other updates, nothing of what was there before stays.
   * Whether the actor may is decided from the salon in the path alone,
   * before the request is read and before anything is looked up. A request
   * with an entry that breaks a rule changes nothing.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiStaffSchedule[], DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayPlanSchedules(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    const staffId = parseStaffId(id)
    if (staffId.type === 'error') {
      return staffId
    }

    const request = parseWith(
      staffScheduleUpdateRequestSchema,
      input,
      staffScheduleMessages.invalidStaffScheduleUpdate,
    )
    if (request.type === 'error') {
      return request
    }

    const { staffScheduleRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const replaced = await staffScheduleRepository.replace(
      salonId.data,
      staffId.data,
      StaffScheduleWriteMapper.fromUpdateRequest(request.data),
    )
    if (replaced.type === 'error') {
      return replaced
    }
    if (replaced.data === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.staffMember, staffId.data),
      )
    }

    return Result.success(
      replaced.data.map(StaffScheduleReadMapper.toApiStaffSchedule),
    )
  }
}
