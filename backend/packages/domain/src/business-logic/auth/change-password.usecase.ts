import { Result } from '@beauty-salon-backend/utility'
import type { Locale } from '@beauty-salon-shared/i18n'
import { authMessages } from '@beauty-salon-shared/i18n/messages/api'
import { UserWriteMapper } from '../../mappers/write/user.mapper'
import type { Actor } from '../../models/auth'
import { authPasswordChangeRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { passwordChangedMail } from './_shared/mails'
import { blocklistIssue } from './_shared/password-blocklist'
import { checkPassword } from './_shared/password-check'
import { sessionGone } from './_shared/session-gone'

const MESSAGE = authMessages.invalidPasswordChange

export class ChangePasswordUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Changes the password of the actor, who proves once more who they are
   * with the current one. That check shares the limit on guesses with the
   * login, so a session in the wrong hands cannot be used to try passwords
   * without end. The actor's other sessions end, this one goes on, and the
   * user is told by mail.
   */
  async execute(
    actor: Actor,
    input: unknown,
    language: Locale,
  ): Promise<Result<null, DomainError>> {
    const request = parseWith(authPasswordChangeRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { currentPassword, newPassword } =
      UserWriteMapper.fromPasswordChangeRequest(request.data)

    const { userRepository, passwordHasher, mailer, clock } = this.dependencies
    const now = clock()

    const found = await userRepository.findById(actor.userId)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return sessionGone
    }
    const user = found.data

    const checked = await checkPassword(
      this.dependencies,
      user,
      currentPassword,
      now,
    )
    if (checked.type === 'error') {
      return checked
    }
    if (checked.data.type === 'refused') {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'currentPassword',
            rule: 'incorrect',
            message: authMessages.currentPasswordNotConfirmed,
          },
        ]),
      )
    }
    if (newPassword === currentPassword) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'newPassword',
            rule: 'unchanged',
            message: authMessages.differentFromCurrentPassword,
          },
        ]),
      )
    }
    const blocked = blocklistIssue('newPassword', newPassword, user.email)
    if (blocked !== null) {
      return Result.error(DomainErrors.validation(MESSAGE, [blocked]))
    }

    const passwordHash = await passwordHasher.hash(newPassword)
    if (passwordHash.type === 'error') {
      return passwordHash
    }

    const changed = await userRepository.changePassword(actor.userId, {
      passwordHash: passwordHash.data,
      at: now.toISOString(),
      keepSessionId: actor.sessionId,
    })
    if (changed.type === 'error') {
      return changed
    }
    if (!changed.data) {
      return sessionGone
    }
    mailer.deliver(passwordChangedMail(user.email, language))

    return Result.success(null)
  }
}
