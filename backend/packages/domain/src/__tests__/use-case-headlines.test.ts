import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Result } from '@beauty-salon-backend/utility'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  attachmentMessages,
  authMessages,
  availableSlotMessages,
  bookingMessages,
  customerAllergyMessages,
  customerDeletionRequestMessages,
  customerMessages,
  customerStatisticsMessages,
  customerVersionMessages,
  inventoryAlertMessages,
  inventoryMessages,
  medicalChartMessages,
  paymentMessages,
  paymentMethodMessages,
  pointMessages,
  productMessages,
  purchaseOrderMessages,
  reviewMessages,
  reviewReportMessages,
  saleMessages,
  salesReportMessages,
  salonMessages,
  serviceCategoryMessages,
  serviceMessages,
  shareLinkMessages,
  staffAccountMessages,
  staffInvitationMessages,
  staffMessages,
  staffProfileMessages,
  staffScheduleMessages,
  treatmentRecordMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  IssueAttachmentDownloadUrlUseCase,
  IssueAttachmentUploadUrlUseCase,
  ListAttachmentsUseCase,
} from '../business-logic/attachment'
import {
  ChangePasswordUseCase,
  ConfirmEmailVerificationUseCase,
  DisableTwoFactorUseCase,
  EnableTwoFactorUseCase,
  ForgotPasswordUseCase,
  GenerateBackupCodesUseCase,
  ListSessionsUseCase,
  LoginUseCase,
  RefreshSessionUseCase,
  RegisterUseCase,
  ResetPasswordUseCase,
  SendEmailVerificationUseCase,
  VerifyResetTokenUseCase,
  VerifyTwoFactorUseCase,
} from '../business-logic/auth'
import {
  CheckAvailableSlotUseCase,
  ListAvailableSlotsUseCase,
} from '../business-logic/available-slot'
import {
  CancelBookingUseCase,
  CompleteBookingUseCase,
  CreateBookingServiceUseCase,
  CreateBookingUseCase,
  ListBookingsUseCase,
  RescheduleBookingUseCase,
  UpdateBookingUseCase,
} from '../business-logic/booking'
import {
  BatchGetCustomersUseCase,
  BulkCreateCustomersUseCase,
  BulkDeleteCustomersUseCase,
  BulkUpdateCustomersUseCase,
  CreateCustomerProfileUseCase,
  CreateCustomerUseCase,
  ExportCustomersUseCase,
  ListCustomersUseCase,
  MergeCustomersUseCase,
  UpdateCustomerProfileUseCase,
  UpdateCustomerUseCase,
} from '../business-logic/customer'
import {
  AddCustomerAllergyUseCase,
  ListCustomerAllergiesUseCase,
  UpdateCustomerAllergyUseCase,
} from '../business-logic/customer-allergy'
import {
  CancelCustomerBookingUseCase,
  CreateCustomerBookingUseCase,
  ListCustomerBookingsUseCase,
  RescheduleCustomerBookingUseCase,
} from '../business-logic/customer-booking'
import { RequestCustomerDeletionUseCase } from '../business-logic/customer-deletion-request'
import { GetCustomerStatisticsUseCase } from '../business-logic/customer-statistics'
import {
  GetCustomerHistoryUseCase,
  GetCustomerVersionUseCase,
} from '../business-logic/customer-version'
import {
  CreateInventoryUseCase,
  GetInventoryValueReportUseCase,
  ListExpiringInventoryUseCase,
  ListInventoryMovementsUseCase,
  ListInventoryUseCase,
  ListLowStockInventoryUseCase,
  PerformStockCountUseCase,
  RecordInventoryMovementUseCase,
  UpdateInventoryUseCase,
} from '../business-logic/inventory'
import {
  AcknowledgeInventoryAlertUseCase,
  GetInventoryAlertSummaryUseCase,
  ListInventoryAlertsUseCase,
} from '../business-logic/inventory-alert'
import {
  CreateMedicalChartUseCase,
  ListMedicalChartsUseCase,
  UpdateMedicalChartUseCase,
} from '../business-logic/medical-chart'
import {
  RecordPaymentUseCase,
  RefundPaymentUseCase,
} from '../business-logic/payment'
import {
  CreatePaymentMethodUseCase,
  ListPaymentMethodsUseCase,
  UpdatePaymentMethodUseCase,
} from '../business-logic/payment-method'
import {
  AdjustPointsUseCase,
  EarnPointsUseCase,
  ExpirePointsUseCase,
  GetExpiringPointsUseCase,
  ListPointTransactionsUseCase,
  UsePointsUseCase,
} from '../business-logic/point'
import {
  CreateProductUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from '../business-logic/product'
import {
  CancelPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  ListPurchaseOrdersUseCase,
  ListReorderSuggestionsUseCase,
  ReceivePurchaseOrderUseCase,
  UpdatePurchaseOrderUseCase,
} from '../business-logic/purchase-order'
import {
  CreateReviewUseCase,
  ListReviewsUseCase,
  ReportReviewUseCase,
  RespondToReviewUseCase,
  UpdateReviewUseCase,
} from '../business-logic/review'
import { ListReviewReportsUseCase } from '../business-logic/review-report'
import {
  CalculateSaleUseCase,
  CreateSaleUseCase,
  ListSalesUseCase,
  UpdateSaleUseCase,
  VoidSaleUseCase,
} from '../business-logic/sale'
import {
  ExportSalesReportUseCase,
  GetDailySalesUseCase,
  GetSalesByCategoryUseCase,
  GetSalesByStaffUseCase,
  GetSalesReportUseCase,
  GetSalesTrendsUseCase,
} from '../business-logic/sales-report'
import {
  CreateSalonUseCase,
  ListSalonsUseCase,
  UpdateSalonUseCase,
} from '../business-logic/salon'
import {
  BulkUpdateServicesUseCase,
  CreateServiceUseCase,
  ListServicesUseCase,
  UpdateServiceUseCase,
} from '../business-logic/service'
import {
  CreateServiceCategoryUseCase,
  ListServiceCategoriesUseCase,
  UpdateServiceCategoryUseCase,
} from '../business-logic/service-category'
import {
  CreateShareLinkUseCase,
  GetSharedFileUseCase,
  IssueSharedFileDownloadUrlUseCase,
  ListShareLinksUseCase,
} from '../business-logic/share-link'
import {
  CreateStaffUseCase,
  ListStaffUseCase,
  UpdateStaffUseCase,
} from '../business-logic/staff'
import { UpdateStaffAccountUseCase } from '../business-logic/staff-account'
import {
  AcceptStaffInvitationUseCase,
  CreateStaffInvitationUseCase,
  JoinStaffInvitationUseCase,
  VerifyStaffInvitationUseCase,
} from '../business-logic/staff-invitation'
import {
  ListStaffProfilesUseCase,
  UpdateOwnStaffProfileUseCase,
} from '../business-logic/staff-profile'
import {
  ListStaffSchedulesUseCase,
  UpdateStaffSchedulesUseCase,
} from '../business-logic/staff-schedule'
import {
  AddTreatmentPhotosUseCase,
  CreateTreatmentRecordUseCase,
  GetTreatmentStatisticsUseCase,
  ListTreatmentRecordsUseCase,
  UpdateTreatmentRecordUseCase,
} from '../business-logic/treatment-record'
import { type DomainError, DomainErrors } from '../shared'
import { attachmentDependencies } from './fixtures/attachment-fixtures'
import {
  actors,
  authDependencies,
  userRepositoryWith,
} from './fixtures/auth-fixtures'
import { availableSlotDependencies } from './fixtures/available-slot-fixtures'
import { bookingDependencies } from './fixtures/booking-fixtures'
import { customerAllergyDependencies } from './fixtures/customer-allergy-fixtures'
import { customerBookingDependencies } from './fixtures/customer-booking-fixtures'
import { customerDeletionRequestDependencies } from './fixtures/customer-deletion-request-fixtures'
import { customerDependencies } from './fixtures/customer-fixtures'
import { SALON_ID, salonRepositoryWith } from './fixtures/fixtures'
import { inventoryAlertDependencies } from './fixtures/inventory-alert-fixtures'
import { inventoryDependencies } from './fixtures/inventory-fixtures'
import { medicalChartDependencies } from './fixtures/medical-chart-fixtures'
import { paymentDependencies } from './fixtures/payment-fixtures'
import { paymentMethodDependencies } from './fixtures/payment-method-fixtures'
import { pointDependencies } from './fixtures/point-fixtures'
import { productDependencies } from './fixtures/product-fixtures'
import { purchaseOrderDependencies } from './fixtures/purchase-order-fixtures'
import {
  reviewDependencies,
  reviewReportDependencies,
} from './fixtures/review-fixtures'
import { saleDependencies } from './fixtures/sale-fixtures'
import { salesReportDependencies } from './fixtures/sales-report-fixtures'
import {
  OTHER_CATEGORY_ID,
  serviceCategoryCreateRequest,
  serviceCategoryDependencies,
} from './fixtures/service-category-fixtures'
import { serviceDependencies } from './fixtures/service-fixtures'
import { shareLinkDependencies } from './fixtures/share-link-fixtures'
import { staffAccountDependencies } from './fixtures/staff-account-fixtures'
import { staffDependencies } from './fixtures/staff-fixtures'
import { staffInvitationDependencies } from './fixtures/staff-invitation-fixtures'
import { staffProfileDependencies } from './fixtures/staff-profile-fixtures'
import { staffScheduleDependencies } from './fixtures/staff-schedule-fixtures'
import { treatmentRecordDependencies } from './fixtures/treatment-record-fixtures'

/*
 * A request that breaks a rule is a validation error, whose headline says
 * which request was wrong, in every language: a message of the domain. A
 * use case names its headline where it checks its request, so every use
 * case that names one is asked here with what is no request at all.
 */

const LOGIC = join(import.meta.dirname, '..', 'business-logic')

/** What is a request of no use case, and a query of none. */
const NO_REQUEST = 42

type Refusal = { field: string; rule: string }

/** An ID of a path: the stand-ins of the repositories do not look at what it names. */
const ID = SALON_ID

/** How a request that is no object is refused. */
const NO_OBJECT: Refusal = { field: '', rule: 'invalid_type' }

type Asked = [
  string,
  () => Promise<Result<unknown, DomainError>>,
  LocalizedText,
  Refusal,
]

/** A repository that a request which was refused before never reaches. */
const unreached = async (): Promise<Result<never, DomainError>> =>
  Result.error(DomainErrors.database('Not reached', null))

/** Every use case that names a headline, asked with what it refuses. */
const USE_CASES: Asked[] = [
  [
    'IssueAttachmentDownloadUrlUseCase',
    () =>
      new IssueAttachmentDownloadUrlUseCase(attachmentDependencies()).execute(
        actors.admin,
        ID,
        Result.success(NO_REQUEST),
      ),
    attachmentMessages.invalidAttachmentDownload,
    NO_OBJECT,
  ],
  [
    'IssueAttachmentUploadUrlUseCase',
    () =>
      new IssueAttachmentUploadUrlUseCase(attachmentDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    attachmentMessages.invalidAttachment,
    NO_OBJECT,
  ],
  [
    'ListAttachmentsUseCase',
    () =>
      new ListAttachmentsUseCase(attachmentDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    attachmentMessages.invalidAttachmentSearch,
    NO_OBJECT,
  ],
  [
    'ChangePasswordUseCase',
    () =>
      new ChangePasswordUseCase(authDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    authMessages.invalidPasswordChange,
    NO_OBJECT,
  ],
  [
    'ConfirmEmailVerificationUseCase',
    () =>
      new ConfirmEmailVerificationUseCase(authDependencies()).execute(
        NO_REQUEST,
      ),
    authMessages.invalidEmailVerification,
    NO_OBJECT,
  ],
  [
    'DisableTwoFactorUseCase',
    () =>
      new DisableTwoFactorUseCase(authDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    authMessages.invalidRequestToDisableTwoFactorAuthentication,
    NO_OBJECT,
  ],
  [
    'EnableTwoFactorUseCase',
    () =>
      new EnableTwoFactorUseCase(authDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    authMessages.invalidTwoFactorAuthenticationSetup,
    NO_OBJECT,
  ],
  [
    'ForgotPasswordUseCase',
    () => new ForgotPasswordUseCase(authDependencies()).execute(NO_REQUEST),
    authMessages.invalidPasswordResetRequest,
    NO_OBJECT,
  ],
  [
    'GenerateBackupCodesUseCase',
    () =>
      new GenerateBackupCodesUseCase(authDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    authMessages.invalidRequestForNewBackupCodes,
    NO_OBJECT,
  ],
  [
    'ListSessionsUseCase',
    () =>
      new ListSessionsUseCase(authDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    authMessages.invalidSessionSearch,
    NO_OBJECT,
  ],
  [
    'LoginUseCase',
    () =>
      new LoginUseCase(authDependencies()).execute(NO_REQUEST, {
        ipAddress: null,
        userAgent: null,
      }),
    authMessages.invalidLogin,
    NO_OBJECT,
  ],
  [
    'RefreshSessionUseCase',
    () => new RefreshSessionUseCase(authDependencies()).execute(NO_REQUEST),
    authMessages.invalidTokenRefresh,
    NO_OBJECT,
  ],
  [
    'RegisterUseCase',
    () => new RegisterUseCase(authDependencies()).execute(NO_REQUEST),
    authMessages.invalidRegistration,
    NO_OBJECT,
  ],
  [
    'ResetPasswordUseCase',
    () => new ResetPasswordUseCase(authDependencies()).execute(NO_REQUEST),
    authMessages.invalidPasswordReset,
    NO_OBJECT,
  ],
  [
    'SendEmailVerificationUseCase',
    () =>
      new SendEmailVerificationUseCase(authDependencies()).execute(NO_REQUEST),
    authMessages.invalidEmailVerificationRequest,
    NO_OBJECT,
  ],
  [
    'VerifyResetTokenUseCase',
    () => new VerifyResetTokenUseCase(authDependencies()).execute(NO_REQUEST),
    authMessages.invalidPasswordResetToken,
    NO_OBJECT,
  ],
  [
    'VerifyTwoFactorUseCase',
    () =>
      new VerifyTwoFactorUseCase(authDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    authMessages.invalidTwoFactorAuthenticationCode,
    NO_OBJECT,
  ],
  [
    'CheckAvailableSlotUseCase',
    () =>
      new CheckAvailableSlotUseCase(availableSlotDependencies()).execute(
        actors.admin,
        ID,
        ID,
      ),
    availableSlotMessages.invalidAvailableSlotCheck,
    NO_OBJECT,
  ],
  [
    'ListAvailableSlotsUseCase',
    () =>
      new ListAvailableSlotsUseCase(availableSlotDependencies()).execute(
        ID,
        Result.success(NO_REQUEST),
      ),
    availableSlotMessages.invalidAvailableSlotSearch,
    NO_OBJECT,
  ],
  [
    'CancelBookingUseCase',
    () =>
      new CancelBookingUseCase(bookingDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    bookingMessages.invalidBookingCancellation,
    NO_OBJECT,
  ],
  [
    'CompleteBookingUseCase',
    () =>
      new CompleteBookingUseCase(bookingDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    bookingMessages.invalidBookingCompletion,
    NO_OBJECT,
  ],
  [
    'CreateBookingServiceUseCase',
    () =>
      new CreateBookingServiceUseCase(bookingDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    bookingMessages.invalidBookingService,
    NO_OBJECT,
  ],
  [
    'CreateBookingUseCase',
    () =>
      new CreateBookingUseCase(bookingDependencies()).execute(
        actors.admin,
        NO_REQUEST,
        { ipAddress: null, userAgent: null },
      ),
    bookingMessages.invalidBooking,
    NO_OBJECT,
  ],
  [
    'ListBookingsUseCase',
    () =>
      new ListBookingsUseCase(bookingDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    bookingMessages.invalidBookingSearch,
    NO_OBJECT,
  ],
  [
    'RescheduleBookingUseCase',
    () =>
      new RescheduleBookingUseCase(bookingDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    bookingMessages.invalidBookingReschedule,
    NO_OBJECT,
  ],
  [
    'UpdateBookingUseCase',
    () =>
      new UpdateBookingUseCase(bookingDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    bookingMessages.invalidBookingUpdate,
    NO_OBJECT,
  ],
  [
    'BatchGetCustomersUseCase',
    () =>
      new BatchGetCustomersUseCase(customerDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    customerMessages.invalidCustomerBatch,
    NO_OBJECT,
  ],
  [
    'BulkCreateCustomersUseCase',
    () =>
      new BulkCreateCustomersUseCase(customerDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    customerMessages.invalidCustomers,
    NO_OBJECT,
  ],
  [
    'BulkDeleteCustomersUseCase',
    () =>
      new BulkDeleteCustomersUseCase(customerDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    customerMessages.invalidCustomerDeletion,
    NO_OBJECT,
  ],
  [
    'BulkUpdateCustomersUseCase',
    () =>
      new BulkUpdateCustomersUseCase(customerDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    customerMessages.invalidCustomerUpdates,
    NO_OBJECT,
  ],
  [
    'CreateCustomerProfileUseCase',
    () =>
      new CreateCustomerProfileUseCase(customerDependencies()).execute(
        actors.customerWithoutProfile,
        NO_REQUEST,
      ),
    customerMessages.invalidCustomerProfile,
    NO_OBJECT,
  ],
  [
    'CreateCustomerUseCase',
    () =>
      new CreateCustomerUseCase(customerDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    customerMessages.invalidCustomer,
    NO_OBJECT,
  ],
  [
    'ExportCustomersUseCase',
    () =>
      new ExportCustomersUseCase(customerDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    customerMessages.invalidCustomerExport,
    NO_OBJECT,
  ],
  [
    'ListCustomersUseCase',
    () =>
      new ListCustomersUseCase(customerDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    customerMessages.invalidCustomerSearch,
    NO_OBJECT,
  ],
  [
    'MergeCustomersUseCase',
    () =>
      new MergeCustomersUseCase(customerDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    customerMessages.invalidCustomerMerge,
    NO_OBJECT,
  ],
  [
    'UpdateCustomerProfileUseCase',
    () =>
      new UpdateCustomerProfileUseCase(customerDependencies()).execute(
        actors.customer,
        NO_REQUEST,
      ),
    customerMessages.invalidCustomerProfileUpdate,
    NO_OBJECT,
  ],
  [
    'UpdateCustomerUseCase',
    () =>
      new UpdateCustomerUseCase(customerDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    customerMessages.invalidCustomerUpdate,
    NO_OBJECT,
  ],
  [
    'AddCustomerAllergyUseCase',
    () =>
      new AddCustomerAllergyUseCase(customerAllergyDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    customerAllergyMessages.invalidCustomerAllergy,
    NO_OBJECT,
  ],
  [
    'ListCustomerAllergiesUseCase',
    () =>
      new ListCustomerAllergiesUseCase(customerAllergyDependencies()).execute(
        actors.admin,
        ID,
        Result.success(NO_REQUEST),
      ),
    customerAllergyMessages.invalidCustomerAllergySearch,
    NO_OBJECT,
  ],
  [
    'UpdateCustomerAllergyUseCase',
    () =>
      new UpdateCustomerAllergyUseCase(customerAllergyDependencies()).execute(
        actors.admin,
        ID,
        ID,
        NO_REQUEST,
      ),
    customerAllergyMessages.invalidCustomerAllergy,
    NO_OBJECT,
  ],
  [
    'CancelCustomerBookingUseCase',
    () =>
      new CancelCustomerBookingUseCase(customerBookingDependencies()).execute(
        actors.customer,
        ID,
        NO_REQUEST,
      ),
    bookingMessages.invalidBookingCancellation,
    NO_OBJECT,
  ],
  [
    'CreateCustomerBookingUseCase',
    () =>
      new CreateCustomerBookingUseCase(customerBookingDependencies()).execute(
        actors.customer,
        NO_REQUEST,
        { ipAddress: null, userAgent: null },
      ),
    bookingMessages.invalidBooking,
    NO_OBJECT,
  ],
  [
    'ListCustomerBookingsUseCase',
    () =>
      new ListCustomerBookingsUseCase(customerBookingDependencies()).execute(
        actors.customer,
        Result.success(NO_REQUEST),
      ),
    bookingMessages.invalidBookingSearch,
    NO_OBJECT,
  ],
  [
    'RescheduleCustomerBookingUseCase',
    () =>
      new RescheduleCustomerBookingUseCase(
        customerBookingDependencies(),
      ).execute(actors.customer, ID, NO_REQUEST),
    bookingMessages.invalidBookingReschedule,
    NO_OBJECT,
  ],
  [
    'RequestCustomerDeletionUseCase',
    () =>
      new RequestCustomerDeletionUseCase(
        customerDeletionRequestDependencies(),
      ).execute(actors.admin, ID, NO_REQUEST),
    customerDeletionRequestMessages.invalidCustomerDeletionRequest,
    NO_OBJECT,
  ],
  [
    'GetCustomerStatisticsUseCase',
    () =>
      new GetCustomerStatisticsUseCase({
        customerStatisticsRepository: { findStatistics: unreached },
      }).execute(actors.admin, ID, NO_REQUEST),
    customerStatisticsMessages.invalidCustomerStatistics,
    NO_OBJECT,
  ],
  [
    'GetCustomerHistoryUseCase',
    () =>
      new GetCustomerHistoryUseCase({
        customerVersionRepository: { list: unreached, find: unreached },
      }).execute(actors.admin, ID, Result.success(NO_REQUEST)),
    customerVersionMessages.invalidCustomerHistorySearch,
    NO_OBJECT,
  ],
  [
    'GetCustomerVersionUseCase',
    () =>
      new GetCustomerVersionUseCase({
        customerVersionRepository: { list: unreached, find: unreached },
      }).execute(actors.admin, ID, 'latest'),
    customerVersionMessages.invalidCustomerVersion,
    { field: 'version', rule: 'invalid_format' },
  ],
  [
    'CreateInventoryUseCase',
    () =>
      new CreateInventoryUseCase(inventoryDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    inventoryMessages.invalidStockRow,
    NO_OBJECT,
  ],
  [
    'GetInventoryValueReportUseCase',
    () =>
      new GetInventoryValueReportUseCase(inventoryDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    inventoryMessages.invalidInventoryValueReport,
    NO_OBJECT,
  ],
  [
    'ListExpiringInventoryUseCase',
    () =>
      new ListExpiringInventoryUseCase(inventoryDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    inventoryMessages.invalidExpiringSearch,
    NO_OBJECT,
  ],
  [
    'ListInventoryMovementsUseCase',
    () =>
      new ListInventoryMovementsUseCase(inventoryDependencies()).execute(
        actors.admin,
        ID,
        Result.success(NO_REQUEST),
      ),
    inventoryMessages.invalidStockMovementSearch,
    NO_OBJECT,
  ],
  [
    'ListInventoryUseCase',
    () =>
      new ListInventoryUseCase(inventoryDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    inventoryMessages.invalidInventorySearch,
    NO_OBJECT,
  ],
  [
    'ListLowStockInventoryUseCase',
    () =>
      new ListLowStockInventoryUseCase(inventoryDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    inventoryMessages.invalidLowStockSearch,
    NO_OBJECT,
  ],
  [
    'PerformStockCountUseCase',
    () =>
      new PerformStockCountUseCase(inventoryDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    inventoryMessages.invalidStockCount,
    NO_OBJECT,
  ],
  [
    'RecordInventoryMovementUseCase',
    () =>
      new RecordInventoryMovementUseCase(inventoryDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    inventoryMessages.invalidStockMovement,
    NO_OBJECT,
  ],
  [
    'UpdateInventoryUseCase',
    () =>
      new UpdateInventoryUseCase(inventoryDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    inventoryMessages.invalidStockRow,
    NO_OBJECT,
  ],
  [
    'AcknowledgeInventoryAlertUseCase',
    () =>
      new AcknowledgeInventoryAlertUseCase(
        inventoryAlertDependencies(),
      ).execute(actors.admin, NO_REQUEST),
    inventoryAlertMessages.invalidInventoryAlertAcknowledgement,
    NO_OBJECT,
  ],
  [
    'GetInventoryAlertSummaryUseCase',
    () =>
      new GetInventoryAlertSummaryUseCase(inventoryAlertDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    inventoryAlertMessages.invalidInventoryAlertSummaryRequest,
    NO_OBJECT,
  ],
  [
    'ListInventoryAlertsUseCase',
    () =>
      new ListInventoryAlertsUseCase(inventoryAlertDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    inventoryAlertMessages.invalidInventoryAlertSearch,
    NO_OBJECT,
  ],
  [
    'CreateMedicalChartUseCase',
    () =>
      new CreateMedicalChartUseCase(medicalChartDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    medicalChartMessages.invalidMedicalChart,
    NO_OBJECT,
  ],
  [
    'ListMedicalChartsUseCase',
    () =>
      new ListMedicalChartsUseCase(medicalChartDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    medicalChartMessages.invalidMedicalChartSearch,
    NO_OBJECT,
  ],
  [
    'UpdateMedicalChartUseCase',
    () =>
      new UpdateMedicalChartUseCase(medicalChartDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    medicalChartMessages.invalidMedicalChart,
    NO_OBJECT,
  ],
  [
    'RecordPaymentUseCase',
    () =>
      new RecordPaymentUseCase(paymentDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    paymentMessages.invalidPayment,
    NO_OBJECT,
  ],
  [
    'RefundPaymentUseCase',
    () =>
      new RefundPaymentUseCase(paymentDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    paymentMessages.invalidRefund,
    NO_OBJECT,
  ],
  [
    'CreatePaymentMethodUseCase',
    () =>
      new CreatePaymentMethodUseCase(paymentMethodDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    paymentMethodMessages.invalidPaymentMethod,
    NO_OBJECT,
  ],
  [
    'ListPaymentMethodsUseCase',
    () =>
      new ListPaymentMethodsUseCase(paymentMethodDependencies()).execute(
        actors.admin,
        ID,
        Result.success(NO_REQUEST),
      ),
    paymentMethodMessages.invalidPaymentMethodSearch,
    NO_OBJECT,
  ],
  [
    'UpdatePaymentMethodUseCase',
    () =>
      new UpdatePaymentMethodUseCase(paymentMethodDependencies()).execute(
        actors.admin,
        ID,
        ID,
        NO_REQUEST,
      ),
    paymentMethodMessages.invalidPaymentMethodUpdate,
    NO_OBJECT,
  ],
  [
    'AdjustPointsUseCase',
    () =>
      new AdjustPointsUseCase(pointDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    pointMessages.invalidPointAdjustment,
    NO_OBJECT,
  ],
  [
    'EarnPointsUseCase',
    () =>
      new EarnPointsUseCase(pointDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    pointMessages.invalidPointEarning,
    NO_OBJECT,
  ],
  [
    'ExpirePointsUseCase',
    () =>
      new ExpirePointsUseCase(pointDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    pointMessages.invalidPointExpiry,
    NO_OBJECT,
  ],
  [
    'GetExpiringPointsUseCase',
    () =>
      new GetExpiringPointsUseCase(pointDependencies()).execute(
        actors.admin,
        ID,
        Result.success(NO_REQUEST),
      ),
    pointMessages.invalidExpiringPointsSearch,
    NO_OBJECT,
  ],
  [
    'ListPointTransactionsUseCase',
    () =>
      new ListPointTransactionsUseCase(pointDependencies()).execute(
        actors.admin,
        ID,
        Result.success(NO_REQUEST),
      ),
    pointMessages.invalidPointTransactionSearch,
    NO_OBJECT,
  ],
  [
    'UsePointsUseCase',
    () =>
      new UsePointsUseCase(pointDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    pointMessages.invalidPointUse,
    NO_OBJECT,
  ],
  [
    'CreateProductUseCase',
    () =>
      new CreateProductUseCase(productDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    productMessages.invalidProduct,
    NO_OBJECT,
  ],
  [
    'ListProductsUseCase',
    () =>
      new ListProductsUseCase(productDependencies()).execute(
        actors.admin,
        ID,
        Result.success(NO_REQUEST),
      ),
    productMessages.invalidProductSearch,
    NO_OBJECT,
  ],
  [
    'UpdateProductUseCase',
    () =>
      new UpdateProductUseCase(productDependencies()).execute(
        actors.admin,
        ID,
        ID,
        NO_REQUEST,
      ),
    productMessages.invalidProductUpdate,
    NO_OBJECT,
  ],
  [
    'CancelPurchaseOrderUseCase',
    () =>
      new CancelPurchaseOrderUseCase(purchaseOrderDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    purchaseOrderMessages.invalidPurchaseOrderCancellation,
    NO_OBJECT,
  ],
  [
    'CreatePurchaseOrderUseCase',
    () =>
      new CreatePurchaseOrderUseCase(purchaseOrderDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    purchaseOrderMessages.invalidPurchaseOrder,
    NO_OBJECT,
  ],
  [
    'ListPurchaseOrdersUseCase',
    () =>
      new ListPurchaseOrdersUseCase(purchaseOrderDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    purchaseOrderMessages.invalidPurchaseOrderSearch,
    NO_OBJECT,
  ],
  [
    'ListReorderSuggestionsUseCase',
    () =>
      new ListReorderSuggestionsUseCase(purchaseOrderDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    purchaseOrderMessages.invalidReorderSuggestionSearch,
    NO_OBJECT,
  ],
  [
    'ReceivePurchaseOrderUseCase',
    () =>
      new ReceivePurchaseOrderUseCase(purchaseOrderDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    purchaseOrderMessages.invalidPurchaseOrderReceipt,
    NO_OBJECT,
  ],
  [
    'UpdatePurchaseOrderUseCase',
    () =>
      new UpdatePurchaseOrderUseCase(purchaseOrderDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    purchaseOrderMessages.invalidPurchaseOrder,
    NO_OBJECT,
  ],
  [
    'CreateReviewUseCase',
    () =>
      new CreateReviewUseCase(reviewDependencies()).execute(
        actors.customer,
        NO_REQUEST,
      ),
    reviewMessages.invalidReview,
    NO_OBJECT,
  ],
  [
    'ListReviewsUseCase',
    () => new ListReviewsUseCase(reviewDependencies()).execute(NO_REQUEST),
    reviewMessages.invalidReviewSearch,
    NO_OBJECT,
  ],
  [
    'ReportReviewUseCase',
    () =>
      new ReportReviewUseCase(reviewDependencies()).execute(
        actors.customer,
        ID,
        NO_REQUEST,
      ),
    reviewReportMessages.invalidReviewReport,
    NO_OBJECT,
  ],
  [
    'RespondToReviewUseCase',
    () =>
      new RespondToReviewUseCase(reviewDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    reviewMessages.invalidReviewResponse,
    NO_OBJECT,
  ],
  [
    'UpdateReviewUseCase',
    () =>
      new UpdateReviewUseCase(reviewDependencies()).execute(
        actors.customer,
        ID,
        NO_REQUEST,
      ),
    reviewMessages.invalidReviewUpdate,
    NO_OBJECT,
  ],
  [
    'ListReviewReportsUseCase',
    () =>
      new ListReviewReportsUseCase(reviewReportDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    reviewReportMessages.invalidReviewReportSearch,
    NO_OBJECT,
  ],
  [
    'CalculateSaleUseCase',
    () =>
      new CalculateSaleUseCase(saleDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    saleMessages.invalidCalculation,
    NO_OBJECT,
  ],
  [
    'CreateSaleUseCase',
    () =>
      new CreateSaleUseCase(saleDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    saleMessages.invalidSale,
    NO_OBJECT,
  ],
  [
    'ListSalesUseCase',
    () =>
      new ListSalesUseCase(saleDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    saleMessages.invalidSaleSearch,
    NO_OBJECT,
  ],
  [
    'UpdateSaleUseCase',
    () =>
      new UpdateSaleUseCase(saleDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    saleMessages.invalidSaleUpdate,
    NO_OBJECT,
  ],
  [
    'VoidSaleUseCase',
    () =>
      new VoidSaleUseCase(saleDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    saleMessages.invalidSaleVoid,
    NO_OBJECT,
  ],
  [
    'ExportSalesReportUseCase',
    () =>
      new ExportSalesReportUseCase(salesReportDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    salesReportMessages.invalidSalesReport,
    NO_OBJECT,
  ],
  [
    'GetDailySalesUseCase',
    () =>
      new GetDailySalesUseCase(salesReportDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    salesReportMessages.invalidDailySales,
    NO_OBJECT,
  ],
  [
    'GetSalesByCategoryUseCase',
    () =>
      new GetSalesByCategoryUseCase(salesReportDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    salesReportMessages.invalidSalesReport,
    NO_OBJECT,
  ],
  [
    'GetSalesByStaffUseCase',
    () =>
      new GetSalesByStaffUseCase(salesReportDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    salesReportMessages.invalidSalesReport,
    NO_OBJECT,
  ],
  [
    'GetSalesReportUseCase',
    () =>
      new GetSalesReportUseCase(salesReportDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    salesReportMessages.invalidSalesReport,
    NO_OBJECT,
  ],
  [
    'GetSalesTrendsUseCase',
    () =>
      new GetSalesTrendsUseCase(salesReportDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    salesReportMessages.invalidSalesTrends,
    NO_OBJECT,
  ],
  [
    'CreateSalonUseCase',
    () =>
      new CreateSalonUseCase({
        salonRepository: salonRepositoryWith(),
      }).execute(actors.admin, NO_REQUEST),
    salonMessages.invalidSalon,
    NO_OBJECT,
  ],
  [
    'ListSalonsUseCase',
    () =>
      new ListSalonsUseCase({ salonRepository: salonRepositoryWith() }).execute(
        NO_REQUEST,
      ),
    salonMessages.invalidSalonSearch,
    NO_OBJECT,
  ],
  [
    'UpdateSalonUseCase',
    () =>
      new UpdateSalonUseCase({
        salonRepository: salonRepositoryWith(),
      }).execute(actors.admin, ID, NO_REQUEST),
    salonMessages.invalidSalonUpdate,
    NO_OBJECT,
  ],
  [
    'BulkUpdateServicesUseCase',
    () =>
      new BulkUpdateServicesUseCase(serviceDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    serviceMessages.invalidServiceBulkUpdate,
    NO_OBJECT,
  ],
  [
    'CreateServiceUseCase',
    () =>
      new CreateServiceUseCase(serviceDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    serviceMessages.invalidService,
    NO_OBJECT,
  ],
  [
    'ListServicesUseCase',
    () =>
      new ListServicesUseCase(serviceDependencies()).execute(ID, NO_REQUEST),
    serviceMessages.invalidServiceSearch,
    NO_OBJECT,
  ],
  [
    'UpdateServiceUseCase',
    () =>
      new UpdateServiceUseCase(serviceDependencies()).execute(
        actors.admin,
        ID,
        ID,
        NO_REQUEST,
      ),
    serviceMessages.invalidServiceUpdate,
    NO_OBJECT,
  ],
  [
    'CreateServiceCategoryUseCase',
    () =>
      new CreateServiceCategoryUseCase(serviceCategoryDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    serviceCategoryMessages.invalidServiceCategory,
    NO_OBJECT,
  ],
  [
    'ListServiceCategoriesUseCase',
    () =>
      new ListServiceCategoriesUseCase(serviceCategoryDependencies()).execute(
        ID,
        NO_REQUEST,
      ),
    serviceCategoryMessages.invalidServiceCategorySearch,
    NO_OBJECT,
  ],
  [
    'UpdateServiceCategoryUseCase',
    () =>
      new UpdateServiceCategoryUseCase(serviceCategoryDependencies()).execute(
        actors.admin,
        ID,
        ID,
        NO_REQUEST,
      ),
    serviceCategoryMessages.invalidServiceCategoryUpdate,
    NO_OBJECT,
  ],
  [
    'CreateShareLinkUseCase',
    () =>
      new CreateShareLinkUseCase(shareLinkDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    shareLinkMessages.invalidShareLink,
    NO_OBJECT,
  ],
  [
    'GetSharedFileUseCase',
    () => new GetSharedFileUseCase(shareLinkDependencies()).execute(NO_REQUEST),
    shareLinkMessages.invalidSharedFileRequest,
    NO_OBJECT,
  ],
  [
    'IssueSharedFileDownloadUrlUseCase',
    () =>
      new IssueSharedFileDownloadUrlUseCase(shareLinkDependencies()).execute(
        NO_REQUEST,
      ),
    shareLinkMessages.invalidSharedFileDownload,
    NO_OBJECT,
  ],
  [
    'ListShareLinksUseCase',
    () =>
      new ListShareLinksUseCase(shareLinkDependencies()).execute(
        actors.admin,
        ID,
        Result.success(NO_REQUEST),
      ),
    shareLinkMessages.invalidShareLinkSearch,
    NO_OBJECT,
  ],
  [
    'CreateStaffUseCase',
    () =>
      new CreateStaffUseCase(staffDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    staffMessages.invalidStaffMember,
    NO_OBJECT,
  ],
  [
    'ListStaffUseCase',
    () =>
      new ListStaffUseCase(staffDependencies()).execute(
        actors.admin,
        ID,
        Result.success(NO_REQUEST),
      ),
    staffMessages.invalidStaffSearch,
    NO_OBJECT,
  ],
  [
    'UpdateStaffUseCase',
    () =>
      new UpdateStaffUseCase(staffDependencies()).execute(
        actors.admin,
        ID,
        ID,
        NO_REQUEST,
      ),
    staffMessages.invalidStaffUpdate,
    NO_OBJECT,
  ],
  [
    'UpdateStaffAccountUseCase',
    () =>
      new UpdateStaffAccountUseCase(staffAccountDependencies()).execute(
        actors.admin,
        ID,
        ID,
        NO_REQUEST,
      ),
    staffAccountMessages.invalidStaffAccountUpdate,
    NO_OBJECT,
  ],
  [
    'AcceptStaffInvitationUseCase',
    () =>
      new AcceptStaffInvitationUseCase(staffInvitationDependencies()).execute(
        NO_REQUEST,
      ),
    staffInvitationMessages.invalidStaffInvitation,
    NO_OBJECT,
  ],
  [
    'CreateStaffInvitationUseCase',
    () =>
      new CreateStaffInvitationUseCase(staffInvitationDependencies()).execute(
        actors.admin,
        ID,
        ID,
        NO_REQUEST,
      ),
    staffInvitationMessages.invalidStaffInvitation,
    NO_OBJECT,
  ],
  [
    'JoinStaffInvitationUseCase',
    () =>
      new JoinStaffInvitationUseCase(staffInvitationDependencies()).execute(
        actors.withoutScope,
        NO_REQUEST,
      ),
    staffInvitationMessages.invalidStaffInvitation,
    NO_OBJECT,
  ],
  [
    'VerifyStaffInvitationUseCase',
    () =>
      new VerifyStaffInvitationUseCase(staffInvitationDependencies()).execute(
        NO_REQUEST,
      ),
    staffInvitationMessages.invalidStaffInvitation,
    NO_OBJECT,
  ],
  [
    'ListStaffProfilesUseCase',
    () =>
      new ListStaffProfilesUseCase(staffProfileDependencies()).execute(
        NO_REQUEST,
      ),
    staffProfileMessages.invalidStaffProfileSearch,
    NO_OBJECT,
  ],
  [
    'UpdateOwnStaffProfileUseCase',
    () =>
      new UpdateOwnStaffProfileUseCase(staffProfileDependencies()).execute(
        actors.ofSalon('staff'),
        NO_REQUEST,
      ),
    staffProfileMessages.invalidStaffProfileUpdate,
    NO_OBJECT,
  ],
  [
    'ListStaffSchedulesUseCase',
    () =>
      new ListStaffSchedulesUseCase(staffScheduleDependencies()).execute(
        actors.admin,
        ID,
        ID,
        NO_REQUEST,
      ),
    staffScheduleMessages.invalidStaffScheduleSearch,
    NO_OBJECT,
  ],
  [
    'UpdateStaffSchedulesUseCase',
    () =>
      new UpdateStaffSchedulesUseCase(staffScheduleDependencies()).execute(
        actors.admin,
        ID,
        ID,
        NO_REQUEST,
      ),
    staffScheduleMessages.invalidStaffScheduleUpdate,
    NO_OBJECT,
  ],
  [
    'AddTreatmentPhotosUseCase',
    () =>
      new AddTreatmentPhotosUseCase(treatmentRecordDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    treatmentRecordMessages.invalidTreatmentPhotos,
    NO_OBJECT,
  ],
  [
    'CreateTreatmentRecordUseCase',
    () =>
      new CreateTreatmentRecordUseCase(treatmentRecordDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    treatmentRecordMessages.invalidTreatmentRecord,
    NO_OBJECT,
  ],
  [
    'GetTreatmentStatisticsUseCase',
    () =>
      new GetTreatmentStatisticsUseCase(treatmentRecordDependencies()).execute(
        actors.admin,
        NO_REQUEST,
      ),
    treatmentRecordMessages.invalidTreatmentStatistics,
    NO_OBJECT,
  ],
  [
    'ListTreatmentRecordsUseCase',
    () =>
      new ListTreatmentRecordsUseCase(treatmentRecordDependencies()).execute(
        actors.admin,
        Result.success(NO_REQUEST),
      ),
    treatmentRecordMessages.invalidTreatmentRecordSearch,
    NO_OBJECT,
  ],
  [
    'UpdateTreatmentRecordUseCase',
    () =>
      new UpdateTreatmentRecordUseCase(treatmentRecordDependencies()).execute(
        actors.admin,
        ID,
        NO_REQUEST,
      ),
    treatmentRecordMessages.invalidTreatmentRecord,
    NO_OBJECT,
  ],
]

/** A token that was mailed to nobody. */
const MAILED = { token: 'mailed-token' }

/** Dependencies whose users hold no address of mail and no mailed token. */
const withoutUsers = () =>
  authDependencies({
    userRepository: userRepositoryWith({
      findByEmail: async () => Result.success(null),
      confirmEmail: async () => Result.success(null),
      findByPasswordResetToken: async () => Result.success(null),
    }),
  })

/**
 * The places besides where a use case checks its request at which it says
 * the headline again: a rule the schema cannot check.
 */
const RULES_OF_USE_CASES: Asked[] = [
  [
    'a confirmation of an address of mail with a token nobody holds',
    () => new ConfirmEmailVerificationUseCase(withoutUsers()).execute(MAILED),
    authMessages.invalidEmailVerification,
    { field: 'token', rule: 'invalid_token' },
  ],
  [
    'a registration with a password that repeats the address of mail',
    () =>
      new RegisterUseCase(withoutUsers()).execute({
        email: 'taro.yamada.salon@example.com',
        password: 'Taro Yamada Salon',
      }),
    authMessages.invalidRegistration,
    { field: 'password', rule: 'blocklisted' },
  ],
  [
    'a question about a token that resets no password',
    () => new VerifyResetTokenUseCase(withoutUsers()).execute(MAILED),
    authMessages.invalidPasswordResetToken,
    { field: 'token', rule: 'invalid_token' },
  ],
  [
    'a service category whose parent is no category of the salon',
    () =>
      new CreateServiceCategoryUseCase(
        serviceCategoryDependencies({
          create: async () => Result.success({ type: 'parentNotFound' }),
        }),
      ).execute(actors.admin, ID, {
        ...serviceCategoryCreateRequest(),
        parentId: OTHER_CATEGORY_ID,
      }),
    serviceCategoryMessages.invalidServiceCategory,
    { field: 'parentId', rule: 'not_found' },
  ],
]

/** The use cases whose sources name a headline. */
const useCasesThatNameAHeadline = (): string[] =>
  readdirSync(LOGIC, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.usecase.ts'))
    .map((file) => readFileSync(join(LOGIC, file), 'utf8'))
    .filter((source) => /\b\w+Messages\.invalid\w+/.test(source))
    .map((source) => /export class (\w+)/.exec(source)?.[1] ?? '')

describe('the headline of a request that breaks a rule', () => {
  it.each(USE_CASES)(
    'should say which request was wrong: %s',
    async (_useCase, ask, message, refusal) => {
      // Act
      const result = await ask()

      // Assert
      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation', message, issues: [refusal] },
      })
    },
  )

  it.each(RULES_OF_USE_CASES)(
    'should say which request was wrong where a use case checks a rule itself: %s',
    async (_case, ask, message, refusal) => {
      // Act
      const result = await ask()

      // Assert
      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation', message, issues: [refusal] },
      })
    },
  )

  it('should ask every use case that names a headline', () => {
    // Act
    const useCases = useCasesThatNameAHeadline()

    // Assert
    expect(USE_CASES.map(([useCase]) => useCase).toSorted()).toEqual(
      useCases.toSorted(),
    )
  })
})
