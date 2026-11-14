import type { Result } from '@beauty-salon-backend/utility'
import type { SalonId } from '../models/salon'
import type {
  CategoryId,
  DbNewServiceCategory,
  DbServiceCategory,
  DbServiceCategoryChanges,
} from '../models/service-category'
import type { DomainError } from '../shared'

/** Which categories of a salon a list returns. A null filter does not restrict the list. */
export type ServiceCategoryListCriteria = {
  salonId: SalonId
  limit: number
  /** Return the categories that follow this one; null starts from the first. */
  after: CategoryId | null
  isActive: boolean | null
}

export type ServiceCategoryList = {
  categories: DbServiceCategory[]
  /** Number of categories that match the filters, across all pages. */
  total: number
  hasMore: boolean
}

/** What became of a category that was to be created. */
export type ServiceCategoryCreation =
  | { type: 'created'; category: DbServiceCategory }
  /** `parentId` names no category of the salon. */
  | { type: 'parentNotFound' }

/** What became of a category that was to be changed. */
export type ServiceCategoryUpdate =
  | { type: 'updated'; category: DbServiceCategory }
  /** The salon has no such category. */
  | { type: 'notFound' }
  /** `parentId` names no category of the salon. */
  | { type: 'parentNotFound' }
  /** `parentId` names the category itself or one below it. */
  | { type: 'parentWithinSubtree' }

/**
 * Persistence of the service categories of a salon. Every method is given the
 * salon and sees only its categories: a category of another salon is one
 * that does not exist. Whether the salon itself exists is not looked at
 * here.
 *
 * A write that names a parent checks it and writes in one transaction, so
 * that the categories of a salon stay a forest: every parent is a category
 * of the same salon, and no category is its own ancestor.
 */
export interface IServiceCategoryRepository {
  create(
    salonId: SalonId,
    category: DbNewServiceCategory,
  ): Promise<Result<ServiceCategoryCreation, DomainError>>

  findById(
    salonId: SalonId,
    id: CategoryId,
  ): Promise<Result<DbServiceCategory | null, DomainError>>

  /**
   * In display order. Resolves to null when the cursor (`after`) names no
   * category of the salon: a deleted category is gone, and nothing says
   * where the page would begin.
   */
  list(
    criteria: ServiceCategoryListCriteria,
  ): Promise<Result<ServiceCategoryList | null, DomainError>>

  update(
    salonId: SalonId,
    id: CategoryId,
    changes: DbServiceCategoryChanges,
  ): Promise<Result<ServiceCategoryUpdate, DomainError>>

  /**
   * Removes the category. Its subcategories become top-level categories and
   * its services lose their category. Resolves to false when the salon has
   * no such category.
   */
  delete(
    salonId: SalonId,
    id: CategoryId,
  ): Promise<Result<boolean, DomainError>>
}
