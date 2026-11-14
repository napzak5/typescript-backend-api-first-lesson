import {
  type CustomerUseCaseDependencies,
  DeleteCustomerUseCase,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { sendProblem } from '../../shared/responses'
import type { CustomerParams } from './_shared'

/**
 * DELETE /api/v1/customers/:id - delete a customer (the row is kept and
 * hidden; administrators, and the owner and the managers of a salon)
 */
export const deleteCustomerHandler = (
  dependencies: CustomerUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<CustomerParams, ProblemDetails> => {
  const useCase = new DeleteCustomerUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
