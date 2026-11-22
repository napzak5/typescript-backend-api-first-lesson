import {
  FAILED,
  type Forbidden,
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  PUBLIC_UNANSWERED_PARTS,
  pageOf,
  type RefusedValue,
  refusedValuesOf,
  toTheEnd,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsServiceBulkUpdateRequest,
  type ModelsServiceCategoryCreateRequest,
  type ModelsServiceCategoryResponse,
  type ModelsServiceCategoryUpdateRequest,
  type ModelsServiceCreateRequest,
  type ModelsServiceResponse,
  type ModelsServiceUpdateRequest,
  serviceCategoryCrudCreate,
  serviceCategoryCrudDelete,
  serviceCategoryCrudGet,
  serviceCategoryCrudList,
  serviceCategoryCrudUpdate,
  serviceCrudBulkUpdate,
  serviceCrudCreate,
  serviceCrudDelete,
  serviceCrudGet,
  serviceCrudUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import type { ServicesRead } from '../../salons/api/salons-api'

/*
 * The menu of a salon: the categories it sorts its services into, and the
 * services. Everybody reads it; the owner, a manager and an administrator
 * change it.
 */

const FORBIDDEN: Forbidden = { type: 'forbidden' }

const KEEPERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether a role changes the menu of its salon: the owner, a manager and an administrator. */
export const mayKeepMenu = (role: string): boolean => KEEPERS.includes(role)

/** The key the categories of a salon are read under. */
export const categoriesKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'service-categories',
]

/** The key a category is read under. */
export const categoryKeyOf = (categoryId: string): string[] => [
  'service-category',
  categoryId,
]

/** The key a service is read under. */
export const serviceKeyOf = (serviceId: string): string[] => [
  'service',
  serviceId,
]

export type CategoriesRead =
  | { type: 'found'; items: ModelsServiceCategoryResponse[] }
  | NotFound
  | Unread

/**
 * The categories of a salon, read to the end, the inactive among them, in
 * the order of the menu. A category removed while the pages are read
 * leaves the cursor nowhere (400): the list is read again from the start.
 */
export const readCategories = (salonId: string): Promise<CategoriesRead> =>
  toTheEnd(async (cursor) => {
    const answer = await serviceCategoryCrudList(salonId, {
      ...from(cursor),
      limit: LARGEST_PAGE,
    }).catch(() => null)

    return match(answer)
      .returnType<Page<ModelsServiceCategoryResponse> | NotFound | Unread>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 404 }, () => NOT_FOUND)
      .with({ status: 400 }, () => FAILED)
      .with(P.union(...PUBLIC_UNANSWERED_PARTS), unreadOf)
      .exhaustive(outsideTheContract)
  })

/** The menu as both its lists were read, or what stopped one of them; nothing while they are read. */
type MenuRead =
  | {
      type: 'found'
      categories: ModelsServiceCategoryResponse[]
      services: ModelsServiceResponse[]
    }
  | NotFound
  | Unread
  | undefined

/**
 * The menu of a salon out of its categories and its services: what stops
 * one of the lists stops the menu, the categories first, also while the
 * other is still read.
 */
export const menuOf = (
  categories: CategoriesRead | undefined,
  services: ServicesRead | undefined,
): MenuRead => {
  if (categories !== undefined && categories.type !== 'found') {
    return categories
  }
  if (services !== undefined && services.type !== 'found') {
    return services
  }
  if (categories === undefined || services === undefined) {
    return undefined
  }

  return {
    type: 'found',
    categories: categories.items,
    services: services.items,
  }
}

export type CategoryRead =
  | { type: 'found'; category: ModelsServiceCategoryResponse }
  | NotFound
  | Unread

/** A category of the salon; one of another salon, or none, is not found. */
export const readCategory = async (
  salonId: string,
  categoryId: string,
): Promise<CategoryRead> => {
  const answer = await serviceCategoryCrudGet(salonId, categoryId).catch(
    () => null,
  )

  return match(answer)
    .returnType<CategoryRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      category: data.data,
    }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with(P.union(...PUBLIC_UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

export type ServiceRead =
  | { type: 'found'; service: ModelsServiceResponse }
  | NotFound
  | Unread

/** A service of the salon, with its options; a removed one is not found. */
export const readService = async (
  salonId: string,
  serviceId: string,
): Promise<ServiceRead> => {
  const answer = await serviceCrudGet(salonId, serviceId).catch(() => null)

  return match(answer)
    .returnType<ServiceRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      service: data.data,
    }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with(P.union(...PUBLIC_UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * What came of a write of a category. Not found is the salon, for a new
 * category, and the category, for a change.
 */
export type CategoryWrite =
  | { type: 'written'; category: ModelsServiceCategoryResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  | NotFound
  | Forbidden
  | Unread

/** Adds a category to the menu of a salon. */
export const addCategory = async (
  salonId: string,
  request: ModelsServiceCategoryCreateRequest,
): Promise<CategoryWrite> => {
  const answer = await serviceCategoryCrudCreate(salonId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<CategoryWrite>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'written',
      category: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** Changes the values of a category that the request names; the others stay as they are. */
export const changeCategory = async (
  salonId: string,
  categoryId: string,
  request: ModelsServiceCategoryUpdateRequest,
): Promise<CategoryWrite> => {
  const answer = await serviceCategoryCrudUpdate(
    salonId,
    categoryId,
    request,
  ).catch(() => null)

  return match(answer)
    .returnType<CategoryWrite>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'written',
      category: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of the removal of a category. */
export type CategoryRemoval =
  | { type: 'removed' }
  | NotFound
  | Forbidden
  | Unread

/**
 * Removes a category. Its children become categories of the top, and its
 * services are of no category; both stay. One removed meanwhile is not
 * found.
 */
export const removeCategory = async (
  salonId: string,
  categoryId: string,
): Promise<CategoryRemoval> => {
  const answer = await serviceCategoryCrudDelete(salonId, categoryId).catch(
    () => null,
  )

  return match(answer)
    .returnType<CategoryRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * What came of a write of a service. Not found is the salon, for a new
 * service, and the service, for a change.
 */
export type ServiceWrite =
  | { type: 'written'; service: ModelsServiceResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  | NotFound
  | Forbidden
  | Unread

/** Adds a service to the menu of a salon, with its options. */
export const addService = async (
  salonId: string,
  request: ModelsServiceCreateRequest,
): Promise<ServiceWrite> => {
  const answer = await serviceCrudCreate(salonId, request).catch(() => null)

  return match(answer)
    .returnType<ServiceWrite>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'written',
      service: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * Changes the values of a service that the request names; the others stay
 * as they are. Options that are named take the place of all of them.
 */
export const changeService = async (
  salonId: string,
  serviceId: string,
  request: ModelsServiceUpdateRequest,
): Promise<ServiceWrite> => {
  const answer = await serviceCrudUpdate(salonId, serviceId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<ServiceWrite>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'written',
      service: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of the removal of a service. */
export type ServiceRemoval =
  | { type: 'removed' }
  | { type: 'inUse' }
  | NotFound
  | Forbidden
  | Unread

/**
 * Removes a service from the menu. A service that a package is made of, or
 * that a booking not over yet has a line of, stays (409). One removed
 * meanwhile is not found.
 */
export const removeService = async (
  salonId: string,
  serviceId: string,
): Promise<ServiceRemoval> => {
  const answer = await serviceCrudDelete(salonId, serviceId).catch(() => null)

  return match(answer)
    .returnType<ServiceRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 409 }, () => ({ type: 'inUse' }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of a change of several services at once. */
export type ServicesChange =
  | { type: 'changed'; updated: readonly string[] }
  | { type: 'invalid'; values: RefusedValue[] }
  | { type: 'servicesGone' }
  | Forbidden
  | Unread

/**
 * Gives every service the request names the same values: all of them, or
 * none. When one of them is not in the menu any more (or the salon is
 * not), none is changed.
 */
export const changeServices = async (
  salonId: string,
  request: ModelsServiceBulkUpdateRequest,
): Promise<ServicesChange> => {
  const answer = await serviceCrudBulkUpdate(salonId, request).catch(() => null)

  return match(answer)
    .returnType<ServicesChange>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'changed',
      updated: data.data.updated,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => ({ type: 'servicesGone' }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}
