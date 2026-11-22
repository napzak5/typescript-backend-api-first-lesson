import { Result } from '@beauty-salon-backend/utility'
import { authMessages } from '@beauty-salon-shared/i18n/messages/api'
import { UserWriteMapper } from '../../mappers/write/user.mapper'
import type { Actor } from '../../models/auth'
import { authTwoFactorDisableRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { twoFactorDisabledMail } from './_shared/mails'
import { checkPassword } from './_shared/password-check'
import { checkSecondFactor } from './_shared/second-factor'
import { sessionGone } from './_shared/session-gone'

const MESSAGE = authMessages.invalidRequestToDisableTwoFactorAuthentication

const notEnabled = Result.error(
  DomainErrors.conflict('Two-factor authentication is not enabled'),
)

export class DisableTwoFactorUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Turns two-factor authentication off for the actor, who proves both
   * factors once more: the password, and a code of the authenticator app
   * or a backup code (so that a user who lost the app can turn it off and
   * set it up again). The secret and the backup codes are forgotten, and
   * the user is told by mail.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<null, DomainError>> {
    const request = parseWith(authTwoFactorDisableRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { password, code } = UserWriteMapper.fromTwoFactorDisableRequest(
      request.data,
    )

    const { userRepository, mailer, clock } = this.dependencies
    const now = clock()

    const found = await userRepository.findById(actor.userId)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return sessionGone
    }
    const user = found.data

    const passwordChecked = await checkPassword(
      this.dependencies,
      user,
      password,
      now,
    )
    if (passwordChecked.type === 'error') {
      return passwordChecked
    }
    if (passwordChecked.data.type === 'refused') {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'password',
            rule: 'incorrect',
            message: 'The password could not be confirmed',
          },
        ]),
      )
    }
    if (user.twoFactorStatus !== 'enabled') {
      return notEnabled
    }

    const codeChecked = await checkSecondFactor(
      this.dependencies,
      user,
      code,
      now,
    )
    if (codeChecked.type === 'error') {
      return codeChecked
    }
    if (codeChecked.data.type === 'refused') {
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

    const disabled = await userRepository.disableTwoFactor(actor.userId)
    if (disabled.type === 'error') {
      return disabled
    }
    if (!disabled.data) {
      return notEnabled
    }
    mailer.deliver(twoFactorDisabledMail(user.email))

    return Result.success(null)
  }
}
