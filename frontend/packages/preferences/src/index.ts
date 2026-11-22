/*
 * What a customer wishes for, as a form writes it: the form, what it was
 * sent with, and what it says when the API refused it. The customer writes
 * it on their page of the portal; the salon writes it in the ledger of the
 * admin application. How the preferences are read is here as well: each
 * application says how it names the staff they name.
 */

export {
  PreferencesDetails,
  type PreferencesDetailsProps,
} from './components/preferences-details/preferences-details'
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
  staffNamed,
} from './staff-choices'
