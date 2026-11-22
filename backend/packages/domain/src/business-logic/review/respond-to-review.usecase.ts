import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { ReviewReadMapper } from '../../mappers/read/review.mapper'
import { ReviewWriteMapper } from '../../mappers/write/review.mapper'
import type { Actor } from '../../models/auth'
import { type ApiReviewResponse, parseReviewId } from '../../models/review'
import { reviewRespondRequestSchema } from '../../schemas/review.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { reviewResponderOf } from './_shared/authorization'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'
import { toUnrespondedReviewError } from './_shared/refusals'
import { mayRespondWith } from './_shared/response'

const MESSAGE = 'Invalid review response'

export class RespondToReviewUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * Writes, replaces or takes down the response of a salon to a review,
   * and returns the review as it is then. What the review says, the time
   * it was written and the rating of its salon stay as they are. Whether
   * the actor responds to reviews is decided before the request is read,
   * and whether they say this before the review is looked up.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiReviewResponse, DomainError>> {
    const responder = reviewResponderOf(actor)
    if (responder.type === 'error') {
      return responder
    }
    const reviewId = parseReviewId(id)
    if (reviewId.type === 'error') {
      return reviewId
    }
    const request = parseWith(reviewRespondRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const requested = ReviewWriteMapper.fromRespondRequest(request.data)
    if (!mayRespondWith(responder.data, requested.ownerResponse)) {
      return Result.error(DomainErrors.forbidden())
    }

    const responded = await this.dependencies.reviewRepository.respond(
      reviewId.data,
      responder.data,
      requested,
    )
    if (responded.type === 'error') {
      return responded
    }

    return match(responded.data)
      .returnType<Result<ApiReviewResponse, DomainError>>()
      .with({ type: 'responded' }, ({ review }) =>
        ReviewReadMapper.toApiReview(review),
      )
      .with({ type: 'reviewNotFound' }, { type: 'otherSalon' }, (unresponded) =>
        Result.error(toUnrespondedReviewError(unresponded, reviewId.data)),
      )
      .exhaustive()
  }
}
