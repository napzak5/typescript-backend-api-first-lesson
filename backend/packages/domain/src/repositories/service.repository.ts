import type { Result } from '@beauty-salon-backend/utility'
import type { SalonId } from '../models/salon'
import type {
  DbNewService,
  DbNewServiceOption,
  DbServiceChanges,
  ServiceId,
  ServiceOptionsChange,
  ServiceWithOptions,
} from '../models/service'
import type { CategoryId } from '../models/service-category'
import type { DomainError, ValidationIssue } from '../shared'

/** Which services of a salon a list returns. A null filter does not restrict the list. */
export type ServiceListCriteria = {
  salonId: SalonId
  limit: number
  /** Return the services that follow this one; null starts from the first. */
  after: ServiceId | null
  categoryId: CategoryId | null
  isActive: boolean | null
}

export type ServiceList = {
  services: ServiceWithOptions[]
  /** Number of services that match the filters, across all pages. */
  total: number
  hasMore: boolean
}

/** Why a service cannot be stored as asked. Nothing was written. */
export type ServiceWriteRefusal =
  /** `categoryId` names no category of the salon. */
  | { type: 'categoryNotFound' }
  /** `packageServiceIds` names something the salon does not offer: no service of the salon, or a deleted one. */
  | { type: 'packageMemberNotFound' }
  /** `packageServiceIds` names a package. Packages do not nest. */
  | { type: 'packageMemberIsPackage' }

/** What became of a service that was to be created. */
export type ServiceCreation =
  | { type: 'created'; service: ServiceWithOptions }
  | ServiceWriteRefusal

/** Why services cannot be changed as asked. Nothing was changed. */
export type ServiceChangeRefusal =
  | ServiceWriteRefusal
  /** The salon has no such service, or it is deleted. */
  | { type: 'notFound'; id: ServiceId }
  /** The service as it would be stored breaks a rule that ties its properties together. */
  | { type: 'invalid'; issues: ValidationIssue[] }
  /** A package contains the service, so it cannot become a package itself. */
  | { type: 'containedInPackage' }

/** What became of a service that was to be changed. */
export type ServiceUpdate =
  | { type: 'updated'; service: ServiceWithOptions }
  | ServiceChangeRefusal

/** What became of several services that were to be changed alike. */
export type ServiceBulkUpdate = { type: 'updated' } | ServiceChangeRefusal

/** What became of a service that was to be deleted. */
export type ServiceDeletion =
  | { type: 'deleted' }
  /** The salon has no such service, or it is deleted already. */
  | { type: 'notFound' }
  /** A package contains the service; it has to leave the package first. */
  | { type: 'containedInPackage' }
  /** A booking that is not finished has a service line of the service. */
  | { type: 'bookingsUnfinished' }

/**
 * Persistence of the services of a salon and of their options. Every method
 * is given the salon and sees only its services: a service of another salon
 * is one that does not exist, and so is a deleted one. Whether the salon
 * itself exists is not looked at here.
 *
 * The database cannot guarantee what ties a service to other rows: that its
 * category is of the same salon, and that a package combines services of
 * the same salon that are neither deleted nor packages themselves. A write
 * checks these and writes in one transaction, holding the rows it looked at.
 */
export interface IServiceRepository {
  create(
    salonId: SalonId,
    service: DbNewService,
    options: DbNewServiceOption[],
  ): Promise<Result<ServiceCreation, DomainError>>

  findById(
    salonId: SalonId,
    id: ServiceId,
  ): Promise<Result<ServiceWithOptions | null, DomainError>>

  /**
   * In the order of a menu, without the deleted services. Resolves to null
   * when the cursor (`after`) names no service of the salon. A deleted
   * service still says where a page begins, because its row stays.
   */
  list(
    criteria: ServiceListCriteria,
  ): Promise<Result<ServiceList | null, DomainError>>

  /**
   * Changes the given columns of one service and, if asked, replaces its
   * options. The rules that tie properties together are checked for the
   * service as it will be stored.
   */
  update(
    salonId: SalonId,
    id: ServiceId,
    changes: DbServiceChanges,
    options: ServiceOptionsChange,
  ): Promise<Result<ServiceUpdate, DomainError>>

  /**
   * Applies the same changes to every one of the services, or to none: one
   * that is missing, or one that the changes would leave breaking a rule,
   * refuses them all.
   */
  updateMany(
    salonId: SalonId,
    ids: ServiceId[],
    changes: DbServiceChanges,
    options: ServiceOptionsChange,
  ): Promise<Result<ServiceBulkUpdate, DomainError>>

  /**
   * Marks the service as deleted, unless a package contains it or a booking
   * that is not finished has it. Its options stay with it.
   */
  delete(
    salonId: SalonId,
    id: ServiceId,
  ): Promise<Result<ServiceDeletion, DomainError>>
}
