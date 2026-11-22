import { Result } from '@beauty-salon-backend/utility'
import { UserWriteMapper } from '../../mappers/write/user.mapper'
import type { Actor } from '../../models/auth'
import { authTwoFactorVerifyRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { twoFactorEnabledMail } from './_shared/mails'
import { checkAppCode } from './_shared/second-factor'
import { sessionGone } from './_shared/session-gone'

const MESSAGE = 'Invalid two-factor authentication code'

const nothingPending = Result.error(
  DomainErrors.conflict('No setup of two-factor authentication is under way'),
)

export class VerifyTwoFactorUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Confirms the setup of two-factor authentication with a code of the
   * authenticator app, which shows that the app holds the secret. From then
   * on every login of the actor needs a code, and the user is told by mail.
   * A backup code does not confirm a setup.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<null, DomainError>> {
    const request = parseWith(authTwoFactorVerifyRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { code } = UserWriteMapper.fromTwoFactorVerifyRequest(request.data)

    const { userRepository, mailer, clock } = this.dependencies

    const found = await userRepository.findById(actor.userId)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return sessionGone
    }
    const user = found.data
    const sealedSecret = user.twoFactorSecret
    if (user.twoFactorStatus !== 'pending' || sealedSecret === null) {
      return nothingPending
    }

    const checked = await checkAppCode(this.dependencies, user, code, clock())
    if (checked.type === 'error') {
      return checked
    }
    if (checked.data.type === 'refused') {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'code',
            rule: 'incorrect',
            message: 'The code could not be confirmed',
          },
        ]),
      )
    }

    // The setup that the code confirmed, not one that took its place meanwhile.
    const enabled = await userRepository.enableTwoFactor(
      actor.userId,
      sealedSecret,
    )
    if (enabled.type === 'error') {
      return enabled
    }
    if (!enabled.data) {
      return nothingPending
    }
    mailer.deliver(twoFactorEnabledMail(user.email))

    return Result.success(null)
  }
}
