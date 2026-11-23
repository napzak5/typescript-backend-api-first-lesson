import { Result } from '@beauty-salon-backend/utility'
import {
  availableSlotMessages,
  entityMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { AvailableSlotReadMapper } from '../../mappers/read/available-slot.mapper'
import { SalonReadMapper } from '../../mappers/read/salon.mapper'
import { AvailableSlotWriteMapper } from '../../mappers/write/available-slot.mapper'
import type { ApiAvailableSlotResponse } from '../../models/available-slot'
import type { ApiPage } from '../../models/page'
import { parseSalonIdOfPath } from '../../models/salon'
import { availableSlotSearchRequestSchema } from '../../schemas/available-slot.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { notFound } from '../booking/_shared/plan'
import type { AvailableSlotUseCaseDependencies } from './_shared/dependencies'
import { comesAfter, slotPositionOf } from './_shared/page'
import { timeZoneUnknown } from './_shared/refusals'
import { slotsOf } from './_shared/slots'

const MESSAGE = availableSlotMessages.invalidAvailableSlotSearch

export class ListAvailableSlotsUseCase {
  constructor(
    private readonly dependencies: AvailableSlotUseCaseDependencies,
  ) {}

  /**
   * Lists the slots at which a customer can book a service of the salon on
   * a date: for one staff member or for all, by the time they begin and
   * then by the staff member. Every signed-in user may. What the salon,
   * the service or a staff member does not take is no slot, and no error
   * either; a service or a staff member that is not the salon's is one.
   * The path is looked at before the query, which is why the query
   * arrives as the caller decoded it.
   */
  async execute(
    salon: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiAvailableSlotResponse>, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      availableSlotSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const search = AvailableSlotWriteMapper.fromSearchRequest(
      request.data,
      salonId.data,
    )

    const found = await this.dependencies.availableSlotRepository.findDay(
      search.day,
    )
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.salon, salonId.data),
      )
    }

    const { salon: stored, service, staff } = found.data
    const issues = [
      ...(search.day.staffId !== null && staff.length === 0
        ? [notFound('staffId', ruleMessages.aStaffMemberOfSalon)]
        : []),
      ...(service === null
        ? [notFound('serviceId', ruleMessages.aServiceOfSalon)]
        : []),
    ]
    if (service === null || issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const businessHours = SalonReadMapper.toBusinessHours(stored)
    if (businessHours.type === 'error') {
      return businessHours
    }

    const day = slotsOf({
      date: search.day.date,
      now: this.dependencies.clock(),
      duration: search.duration ?? service.duration,
      salon: {
        isActive: stored.isActive,
        timezone: stored.timezone,
        businessHours: businessHours.data,
      },
      calendarDay: found.data.calendarDay,
      service,
      serviceLineStarts: found.data.serviceLineStarts,
      staff,
    })
    if (day.type === 'timeZoneUnknown') {
      return Result.error(timeZoneUnknown())
    }

    const position = search.after === null ? null : slotPositionOf(search.after)
    const rest =
      position === null
        ? day.slots
        : day.slots.filter((slot) => comesAfter(slot, position))
    const page = rest.slice(0, search.limit)

    return Result.success(
      AvailableSlotReadMapper.toApiAvailableSlotPage(
        page,
        { total: day.slots.length, hasMore: rest.length > page.length },
        search,
      ),
    )
  }
}
