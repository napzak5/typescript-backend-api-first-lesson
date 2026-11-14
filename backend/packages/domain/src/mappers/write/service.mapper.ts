import type {
  ApiServiceCreateRequest,
  ApiServiceUpdateRequest,
  DbNewService,
  DbNewServiceOption,
  DbServiceChanges,
  ServiceOptionsChange,
} from '../../models/service'

/**
 * API request → database rows. Property names are the column names and no
 * column changes its representation; a request holds the rows of two tables,
 * the service and its options, and they are told apart here.
 */
export const ServiceWriteMapper = {
  fromCreateRequest(request: ApiServiceCreateRequest): {
    service: DbNewService
    options: DbNewServiceOption[]
  } {
    const { options, ...service } = request

    return { service, options }
  },

  /** Only the properties present in the request become changes. */
  fromUpdateRequest(request: ApiServiceUpdateRequest): {
    changes: DbServiceChanges
    options: ServiceOptionsChange
  } {
    const { options, ...changes } = request

    return {
      changes,
      options:
        options === undefined ? { type: 'keep' } : { type: 'replace', options },
    }
  },
}
