import type { SalonId } from '../../models/salon'
import type {
  ApiServiceCategoryCreateRequest,
  ApiServiceCategoryUpdateRequest,
  DbNewServiceCategory,
  DbServiceCategoryChanges,
} from '../../models/service-category'
import type { ServiceCategoryListCriteria } from '../../repositories/service-category.repository'
import type { ServiceCategorySearchRequest } from '../../schemas/service-category.schema'
import { toPaging } from './page'

/**
 * API request → what the repository takes. Property names are the column
 * names and every column has the representation of the API, so a row and
 * its changes are the request as it is: the mapper is where the compiler
 * checks that the two agree.
 */
export const ServiceCategoryWriteMapper = {
  fromCreateRequest(
    request: ApiServiceCategoryCreateRequest,
  ): DbNewServiceCategory {
    return request
  },

  /** Only the properties present in the request become changes. */
  fromUpdateRequest(
    request: ApiServiceCategoryUpdateRequest,
  ): DbServiceCategoryChanges {
    return request
  },

  /** The categories of the salon of the path; a filter the request does not name is none. */
  fromSearchRequest(
    request: ServiceCategorySearchRequest,
    salonId: SalonId,
  ): ServiceCategoryListCriteria {
    return {
      salonId,
      ...toPaging(request),
      isActive: request.isActive ?? null,
    }
  },
}
