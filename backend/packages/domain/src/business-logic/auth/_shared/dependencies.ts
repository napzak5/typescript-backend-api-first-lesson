import type { ISessionRepository } from '../../../repositories/session.repository'
import type { IUserRepository } from '../../../repositories/user.repository'
import type { IPasswordHasher } from '../../../services/password-hasher'
import type { ISessionTokenIssuer } from '../../../services/session-token-issuer'

/** Everything the authentication use cases need from the outside. */
export interface AuthUseCaseDependencies {
  userRepository: IUserRepository
  sessionRepository: ISessionRepository
  passwordHasher: IPasswordHasher
  tokenIssuer: ISessionTokenIssuer
  /** The current time. */
  clock: () => Date
}
