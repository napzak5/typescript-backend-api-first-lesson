import type {
  PointEarning,
  PointMovement,
} from '../../business-logic/point/_shared/plan'
import type { CustomerId } from '../../models/customer'
import type {
  ApiPointExpiringSearchRequest,
  RequestedPointExpiry,
} from '../../models/point'
import type { PointListCriteria } from '../../repositories/point.repository'
import type {
  PointAdjustRequest,
  PointEarnRequest,
  PointExpireRequest,
  PointTransactionSearchRequest,
  PointUseRequest,
} from '../../schemas/point.schema'
import { toPaging } from './page'

/** How many days ahead points count as expiring when a request does not say. */
const DEFAULT_DAYS = 30

/**
 * API request → what the points ledger is asked with. Nothing is
 * converted and no row is made: the point transaction that is written
 * holds the balance after it, which follows from the balance of the
 * customer as it is while the customer is held, so a pure function plans
 * it (`planPoints`), and this mapper returns what such a plan is made
 * from. It is where the compiler checks that a request holds what the
 * plan reads.
 */
export const PointWriteMapper = {
  /** The points a request gives a customer, with the day they lapse. */
  fromEarnRequest(request: PointEarnRequest): PointEarning {
    return { type: 'earned', request }
  },

  /** The points a request takes from the balance of a customer. */
  fromUseRequest(request: PointUseRequest): PointMovement {
    return { type: 'used', request }
  },

  /** The points a request moves by hand, either way. */
  fromAdjustRequest(request: PointAdjustRequest): PointMovement {
    return { type: 'adjusted', request }
  },

  /** Whose points an expiry is asked for, and the day before which they lapsed. */
  fromExpireRequest(request: PointExpireRequest): RequestedPointExpiry {
    return request
  },

  /** How many days ahead points count as expiring: 30 unless the request says. */
  fromExpiringSearchRequest(request: ApiPointExpiringSearchRequest): {
    days: number
  } {
    return { days: request.days ?? DEFAULT_DAYS }
  },

  /**
   * The criteria of the list of the point transactions of a customer: a
   * filter the request does not name is none.
   */
  fromTransactionSearchRequest(
    request: PointTransactionSearchRequest,
    customerId: CustomerId,
  ): PointListCriteria {
    return {
      customerId,
      ...toPaging(request),
      startDate: request.startDate ?? null,
      endDate: request.endDate ?? null,
    }
  },
}
