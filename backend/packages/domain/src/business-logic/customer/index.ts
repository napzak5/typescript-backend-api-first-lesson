export type { CustomerMergeRequest } from '../../schemas/customer-merge.schema'
export type { CustomerUseCaseDependencies } from './_shared/dependencies'
export { type CustomerFile, MOST_EXPORTED } from './_shared/export'
export {
  type AllergyMerge,
  type AllergyValues,
  allergyMergeOf,
  type ChartList,
  type ChartMerge,
  type ChartValues,
  chartMergeOf,
  type MergeSide,
  mergedLedgerOf,
  type PreferencesMerge,
  preferencesMergeOf,
  sideOf,
} from './_shared/merge'
export { BatchGetCustomersUseCase } from './batch-get-customers.usecase'
export { BulkCreateCustomersUseCase } from './bulk-create-customers.usecase'
export { BulkDeleteCustomersUseCase } from './bulk-delete-customers.usecase'
export { BulkUpdateCustomersUseCase } from './bulk-update-customers.usecase'
export { CreateCustomerUseCase } from './create-customer.usecase'
export { CreateCustomerProfileUseCase } from './create-customer-profile.usecase'
export { DeleteCustomerUseCase } from './delete-customer.usecase'
export { ExportCustomerDataUseCase } from './export-customer-data.usecase'
export { ExportCustomersUseCase } from './export-customers.usecase'
export { GetCustomerUseCase } from './get-customer.usecase'
export { GetCustomerProfileUseCase } from './get-customer-profile.usecase'
export {
  type CustomerPage,
  ListCustomersUseCase,
} from './list-customers.usecase'
export { MergeCustomersUseCase } from './merge-customers.usecase'
export { RestoreCustomerUseCase } from './restore-customer.usecase'
export { UpdateCustomerUseCase } from './update-customer.usecase'
export { UpdateCustomerProfileUseCase } from './update-customer-profile.usecase'
