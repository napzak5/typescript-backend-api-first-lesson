import type { ISessionRepository } from '../../../repositories/session.repository'
import type { IUserRepository } from '../../../repositories/user.repository'
import type { IMailer } from '../../../services/mailer'
import type { IPasswordHasher } from '../../../services/password-hasher'
import type { ITokenIssuer } from '../../../services/token-issuer'
import type { ITwoFactorAuthenticator } from '../../../services/two-factor-authenticator'

/** Everything the authentication use cases need from the outside. */
export interface AuthUseCaseDependencies {
  userRepository: IUserRepository
  sessionRepository: ISessionRepository
  passwordHasher: IPasswordHasher
  tokenIssuer: ITokenIssuer
  twoFactorAuthenticator: ITwoFactorAuthenticator
  mailer: IMailer
  /**
   * The origin of the web application whose pages finish the flows that
   * start with a mail, for example `https://app.example.com`.
   */
  publicAppUrl: string
  /** The current time. */
  clock: () => Date
}
