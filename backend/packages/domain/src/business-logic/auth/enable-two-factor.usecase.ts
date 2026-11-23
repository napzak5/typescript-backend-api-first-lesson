import { Result } from '@beauty-salon-backend/utility'
import { authMessages } from '@beauty-salon-shared/i18n/messages/api'
import { UserReadMapper } from '../../mappers/read/user.mapper'
import { UserWriteMapper } from '../../mappers/write/user.mapper'
import type { Actor, ApiAuthTwoFactorSetupResponse } from '../../models/auth'
import { authTwoFactorEnableRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'
import { checkPassword } from './_shared/password-check'
import { sessionGone } from './_shared/session-gone'
import { hashBackupCodes } from './_shared/two-factor-setup'

const MESSAGE = authMessages.invalidTwoFactorAuthenticationSetup

const alreadyEnabled = Result.error(
  DomainErrors.conflict(authMessages.twoFactorAlreadyEnabled),
)

export class EnableTwoFactorUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Starts to set up two-factor authentication for the actor, who proves
   * once more who they are with the password. The answer holds the secret
   * for the authenticator app and the backup codes, and is the only place
   * they are ever shown. Nothing is asked for at login until a code of the
   * app has confirmed the setup. Starting again replaces the secret and
   * the codes of a setup that was not confirmed.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiAuthTwoFactorSetupResponse, DomainError>> {
    const request = parseWith(authTwoFactorEnableRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { password } = UserWriteMapper.fromTwoFactorEnableRequest(
      request.data,
    )

    const { userRepository, passwordHasher, twoFactorAuthenticator, clock } =
      this.dependencies

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
      password,
      clock(),
    )
    if (checked.type === 'error') {
      return checked
    }
    if (checked.data.type === 'refused') {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'password',
            rule: 'incorrect',
            message: authMessages.passwordNotConfirmed,
          },
        ]),
      )
    }
    if (user.twoFactorStatus === 'enabled') {
      return alreadyEnabled
    }

    const { secret, sealed } = twoFactorAuthenticator.issueSecret()
    const backupCodes = twoFactorAuthenticator.issueBackupCodes()
    const backupCodeHashes = await hashBackupCodes(passwordHasher, backupCodes)
    if (backupCodeHashes.type === 'error') {
      return backupCodeHashes
    }

    const started = await userRepository.startTwoFactorSetup(actor.userId, {
      sealedSecret: sealed,
      backupCodeHashes: backupCodeHashes.data,
    })
    if (started.type === 'error') {
      return started
    }

    return started.data
      ? Result.success(
          UserReadMapper.toApiTwoFactorSetup(user.email, secret, backupCodes),
        )
      : alreadyEnabled
  }
}
