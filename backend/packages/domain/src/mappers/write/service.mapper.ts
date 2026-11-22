import type { SalonId } from '../../models/salon'
import type {
  ApiServiceCreateRequest,
  ApiServiceUpdateRequest,
  DbNewService,
  DbNewServiceOption,
  DbServiceChanges,
  ServiceId,
  ServiceOptionsChange,
} from '../../models/service'
import type { ServiceListCriteria } from '../../repositories/service.repository'
import type {
  ServiceBulkUpdateRequest,
  ServiceSearchRequest,
} from '../../schemas/service.schema'
import { toPaging } from './page'

/** The changes of an update, and what becomes of the options. */
type ServiceUpdate = {
  changes: DbServiceChanges
  options: ServiceOptionsChange
}

/** Only the properties present in the request become changes. */
const fromUpdateRequest = (request: ApiServiceUpdateRequest): ServiceUpdate => {
  const { options, ...changes } = request

  return {
    changes,
    options:
      options === undefined ? { type: 'keep' } : { type: 'replace', options },
  }
}

/**
 * API request → what the repository takes. Property names are the column
 * names and no column changes its representation; a request holds the rows
 * of two tables, the service and its options, and they are told apart here.
 */
export const ServiceWriteMapper = {
  fromCreateRequest(request: ApiServiceCreateRequest): {
    service: DbNewService
    options: DbNewServiceOption[]
  } {
    const { options, ...service } = request

    return { service, options }
  },

  fromUpdateRequest,

  /** The same changes for every service the request names. */
  fromBulkUpdateRequest({
    serviceIds,
    updates,
  }: ServiceBulkUpdateRequest): ServiceUpdate & { serviceIds: ServiceId[] } {
    return { serviceIds, ...fromUpdateRequest(updates) }
  },

  /** The services of the salon of the path; a filter the request does not name is none. */
  fromSearchRequest(
    request: ServiceSearchRequest,
    salonId: SalonId,
  ): ServiceListCriteria {
    const { categoryId, isActive } = request

    return {
      salonId,
      ...toPaging(request),
      categoryId: categoryId ?? null,
      isActive: isActive ?? null,
    }
  },
}
