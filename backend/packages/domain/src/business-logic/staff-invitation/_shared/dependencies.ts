import type { ISalonRepository } from '../../../repositories/salon.repository'
import type { IStaffInvitationRepository } from '../../../repositories/staff-invitation.repository'
import type { IMailer } from '../../../services/mailer'
import type { IPasswordHasher } from '../../../services/password-hasher'
import type { ITokenIssuer } from '../../../services/token-issuer'

/** Everything the use cases of the staff invitations need from the outside. */
export interface StaffInvitationUseCaseDependencies {
  staffInvitationRepository: IStaffInvitationRepository
  /** Tells whether the salon of the request exists. */
  salonRepository: ISalonRepository
  passwordHasher: IPasswordHasher
  tokenIssuer: ITokenIssuer
  mailer: IMailer
  /**
   * The origin of the web application whose page accepts an invitation,
   * for example `https://app.example.com`.
   */
  publicAppUrl: string
  /** The current time. */
  clock: () => Date
}
