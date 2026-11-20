/*
 * What a customer wishes for, as a form writes it: the form, what it was
 * sent with, and what it says when the API refused it. The customer writes
 * it on their page of the portal; the salon writes it in the ledger of the
 * admin application. Each application reads and shows the preferences on
 * its own, for its own readers.
 */

export {
  PreferencesForm,
  type PreferencesFormProps,
} from './components/preferences-form/preferences-form'
export { linesOf, pictureAddressesError } from './lines'
export {
  afterPreferencesChange,
  type PreferencesChangeRead,
  type PreferencesRefusal,
  readPreferencesChange,
} from './preferences-flow'
export {
  type StaffChoice,
  staffChoicesOf,
  staffIdsOf,
  staffLabelOf,
} from './staff-choices'
