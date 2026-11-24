import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
  ModelsCustomerResponse,
  ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
import type { NamedChoice } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import {
  adminCustomerMessages,
  adminTreatmentMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { customerNameOf } from '../../customers/api/customers-api'
import type { TreatmentRemoval } from '../api/treatments-api'

const { satisfactions, rated, names, removal } = adminTreatmentMessages
const { naming } = adminCustomerMessages

/*
 * How a treatment record is said: its satisfaction, its customer, and what
 * is said after it was to be removed.
 */

/** How satisfied a customer was, as a record holds it */
type Satisfaction = keyof typeof satisfactions

/** The satisfactions, the highest first */
const SATISFACTIONS: readonly Satisfaction[] = [5, 4, 3, 2, 1]

/** How satisfied the customer was: 「5（とても満足）」. */
export const satisfactionNameOf = (satisfaction: number): LocalizedText => {
  const known = SATISFACTIONS.find((value) => value === satisfaction)

  return known === undefined
    ? formats.numberOf(satisfaction)
    : rated(known, satisfactions[known])
}

/** The satisfactions a form offers, the highest first */
export const SATISFACTION_CHOICES: readonly NamedChoice[] = SATISFACTIONS.map(
  (value) => ({ value: String(value), label: satisfactionNameOf(value) }),
)

/** Who may remove a treatment record: a member of the staff changes it instead */
const REMOVERS: readonly string[] = ['owner', 'manager', 'admin']

export const mayRemoveTreatments = (role: string): boolean =>
  REMOVERS.includes(role)

/** Whether the record was changed after it was written */
export const wasChanged = ({
  createdAt,
  updatedAt,
}: Pick<ModelsTreatmentRecordResponse, 'createdAt' | 'updatedAt'>): boolean =>
  createdAt !== updatedAt

/** The customer a record names: `undefined` for one who left the ledger */
type Customer =
  | Pick<ModelsCustomerResponse, 'lastName' | 'firstName'>
  | undefined

/** A customer as a cell, a term and a line name them: 「山田 花子 様」, or that they left the ledger. */
export const customerCalled = (customer: Customer): LocalizedText =>
  customer === undefined
    ? adminTreatmentMessages.removedCustomer
    : naming.honored(customerNameOf(customer))

/** The same, as a sentence names them. */
export const customerInASentence = (customer: Customer): LocalizedText =>
  customer === undefined
    ? names.removedCustomer
    : naming.honored(customerNameOf(customer))

/** What a removal comes to on the screen. */
export type TreatmentRemovalSays =
  /** The record was removed: said in a notification on the list */
  | { type: 'done'; message: LocalizedText }
  /** Nothing was removed, and another attempt may: said in the dialog */
  | { type: 'again'; message: LocalizedText }
  /** What another attempt does not change: said above the record */
  | { type: 'refused'; message: LocalizedText }
  /** The record was removed meanwhile: the screen says it is not found */
  | { type: 'gone' }

/** What is said after a record was to be removed; the customer is named as a sentence names them. */
export const afterTreatmentRemoval = (
  outcome: TreatmentRemoval,
  customer: LocalizedText,
): TreatmentRemovalSays =>
  match(outcome)
    .returnType<TreatmentRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: removal.done(customer),
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    // The role of the account changed meanwhile
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: removal.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: removal.failed,
    }))
    .exhaustive()

/** Whether a record can be written of a booking: once its treatment began. */
export const isTreated = ({
  status,
}: Pick<ModelsBookingResponse, 'status'>): boolean =>
  status === 'in_progress' || status === 'completed'
