import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { saleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { type DomainError, DomainErrors } from '../../../shared'
import type { SaleChangeRefusal, SaleVoidRefusal } from './change'
import type { SalePlan } from './plan'
import type { ReceiptRefusal } from './receipt'

/** A refusal that says something about the request or about what it meets. */
type AnsweredRefusal = Exclude<SalePlan, { type: 'planned' }>

/**
 * Why a sale was not entered or not corrected, as the error a client gets.
 * A sale number that is taken is not among the reasons: the client did
 * not choose it, and the use case tries another.
 */
export const toRefusalError = (
  refusal: AnsweredRefusal,
  message: LocalizedText,
): DomainError =>
  match(refusal)
    .with({ type: 'invalid' }, ({ issues }) =>
      DomainErrors.validation(message, issues),
    )
    .with({ type: 'timeZoneUnknown' }, () =>
      DomainErrors.conflict(saleMessages.timeZoneUnknown),
    )
    .with({ type: 'bookingBilled' }, () =>
      DomainErrors.conflict(saleMessages.bookingBilled),
    )
    .exhaustive()

/** Why a sale is not corrected whatever the request names, as the error a client gets. */
export const toChangeRefusalError = (refusal: SaleChangeRefusal): DomainError =>
  match(refusal)
    .with({ type: 'void' }, () =>
      DomainErrors.conflict(saleMessages.voidIsNotChanged),
    )
    .with({ type: 'paymentBegun' }, () =>
      DomainErrors.conflict(saleMessages.linesWhilePending),
    )
    .exhaustive()

/** Why a sale has no receipt, as the error a client gets. */
export const toReceiptRefusalError = (refusal: ReceiptRefusal): DomainError =>
  match(refusal)
    .with({ type: 'void' }, () =>
      DomainErrors.conflict(saleMessages.voidHasNoReceipt),
    )
    .with({ type: 'notPaidInFull' }, () =>
      DomainErrors.conflict(saleMessages.notPaidInFull),
    )
    .exhaustive()

/** Why a sale is not voided, as the error a client gets. */
export const toVoidRefusalError = (refusal: SaleVoidRefusal): DomainError =>
  match(refusal)
    .with({ type: 'void' }, () =>
      DomainErrors.conflict(saleMessages.alreadyVoid),
    )
    .with({ type: 'paid' }, () =>
      DomainErrors.conflict(saleMessages.paymentNotRefunded),
    )
    .exhaustive()
