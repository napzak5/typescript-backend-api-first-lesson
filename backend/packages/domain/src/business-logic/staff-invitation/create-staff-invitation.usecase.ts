import { Result } from '@beauty-salon-backend/utility'
import { staffInvitationMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { StaffInvitationReadMapper } from '../../mappers/read/staff-invitation.mapper'
import { StaffInvitationWriteMapper } from '../../mappers/write/staff-invitation.mapper'
import type { Actor } from '../../models/auth'
import { parseSalonIdOfPath } from '../../models/salon'
import { parseStaffId } from '../../models/staff'
import type { ApiStaffInvitationResponse } from '../../models/staff-invitation'
import { staffInvitationCreateRequestSchema } from '../../schemas/staff-invitation.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import {
  latestEndToMailAgain,
  mailedTokenEnd,
  STAFF_INVITATION,
} from '../auth/_shared/mailed-token'
import { staffInvitationMail } from '../auth/_shared/mails'
import { staffNotFound } from '../staff/_shared/refusals'
import { mayGiveRole, mayInviteStaff } from './_shared/authorization'
import type { StaffInvitationUseCaseDependencies } from './_shared/dependencies'
import {
  alreadyHasAccount,
  inactiveStaffStaysOut,
  mailedMomentsAgo,
} from './_shared/refusals'

export class CreateStaffInvitationUseCase {
  constructor(
    private readonly dependencies: StaffInvitationUseCaseDependencies,
  ) {}

  /**
   * Invites a staff member to an account of their own: a token goes to the
   * address the ledger has for them, and the invitation they held, if any,
   * stops working. Whether the actor may is decided from the salon in the
   * path alone, before the request is read; whether they may give the role
   * once the request is read, and before anything is looked up.
   *
   * The result does not tell whether the address has an account: whoever
   * may invite could otherwise ask that of any address. The mail is only
   * handed over, never waited for.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiStaffInvitationResponse, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayInviteStaff(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    const staffId = parseStaffId(id)
    if (staffId.type === 'error') {
      return staffId
    }

    const request = parseWith(
      staffInvitationCreateRequestSchema,
      input,
      staffInvitationMessages.invalidStaffInvitation,
    )
    if (request.type === 'error') {
      return request
    }
    const { role } = StaffInvitationWriteMapper.fromCreateRequest(request.data)
    if (!mayGiveRole(actor, role)) {
      return Result.error(DomainErrors.forbidden())
    }

    const {
      staffInvitationRepository,
      salonRepository,
      tokenIssuer,
      mailer,
      publicAppUrl,
      clock,
    } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const now = clock()
    const token = tokenIssuer.issue()
    const issued = await staffInvitationRepository.issue(
      salonId.data,
      staffId.data,
      {
        role,
        token: {
          tokenHash: token.hash,
          expiresAt: mailedTokenEnd(STAFF_INVITATION, now).toISOString(),
        },
        mailedMomentsAgoIfEndingAfter: latestEndToMailAgain(
          STAFF_INVITATION,
          now,
        ).toISOString(),
      },
    )
    if (issued.type === 'error') {
      return issued
    }

    return match(issued.data)
      .with({ type: 'staffNotFound' }, () =>
        Result.error(staffNotFound(staffId.data)),
      )
      .with({ type: 'linked' }, () =>
        Result.error(alreadyHasAccount(staffId.data)),
      )
      .with({ type: 'inactive' }, () =>
        Result.error(inactiveStaffStaysOut(staffId.data)),
      )
      .with({ type: 'mailedMomentsAgo' }, () =>
        Result.error(mailedMomentsAgo(staffId.data)),
      )
      .with({ type: 'issued' }, ({ invitation, salonName }) => {
        mailer.deliver(
          staffInvitationMail(
            invitation.email,
            salonName,
            publicAppUrl,
            token.token,
          ),
        )

        return StaffInvitationReadMapper.toApiStaffInvitation(invitation)
      })
      .exhaustive()
  }
}
