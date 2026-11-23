import { Result } from '@beauty-salon-backend/utility'
import { authMessages } from '@beauty-salon-shared/i18n/messages/api'
import { UserReadMapper } from '../../mappers/read/user.mapper'
import { UserWriteMapper } from '../../mappers/write/user.mapper'
import type {
  Actor,
  ApiAuthTwoFactorBackupCodesResponse,
} from '../../models/auth'
import { authTwoFactorBackupCodesRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { backupCodesRegeneratedMail } from './_shared/mails'
import { checkSecondFactor } from './_shared/second-factor'
import { sessionGone } from './_shared/session-gone'
import { hashBackupCodes } from './_shared/two-factor-setup'

const MESSAGE = authMessages.invalidRequestForNewBackupCodes

const notEnabled = Result.error(
  DomainErrors.conflict('Two-factor authentication is not enabled'),
)

export class GenerateBackupCodesUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Gives the actor new backup codes, which replace the ones before, after
   * a code of the authenticator app or a backup code has shown who asks.
   * The answer is the only place the new codes are shown, and the user is
   * told by mail.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiAuthTwoFactorBackupCodesResponse, DomainError>> {
    const request = parseWith(
      authTwoFactorBackupCodesRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { code } = UserWriteMapper.fromTwoFactorBackupCodesRequest(
      request.data,
    )

    const {
      userRepository,
      passwordHasher,
      twoFactorAuthenticator,
      mailer,
      clock,
    } = this.dependencies

    const found = await userRepository.findById(actor.userId)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return sessionGone
    }
    const user = found.data
    if (user.twoFactorStatus !== 'enabled') {
      return notEnabled
    }

    const checked = await checkSecondFactor(
      this.dependencies,
      user,
      code,
      clock(),
    )
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

    const backupCodes = twoFactorAuthenticator.issueBackupCodes()
    const backupCodeHashes = await hashBackupCodes(passwordHasher, backupCodes)
    if (backupCodeHashes.type === 'error') {
      return backupCodeHashes
    }

    const replaced = await userRepository.replaceBackupCodes(
      actor.userId,
      backupCodeHashes.data,
    )
    if (replaced.type === 'error') {
      return replaced
    }
    if (!replaced.data) {
      return notEnabled
    }
    mailer.deliver(backupCodesRegeneratedMail(user.email))

    return Result.success(UserReadMapper.toApiTwoFactorBackupCodes(backupCodes))
  }
}
