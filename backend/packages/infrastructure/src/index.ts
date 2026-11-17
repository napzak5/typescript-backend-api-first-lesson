// Database connection
export {
  connectDatabase,
  createDatabase,
  type Database,
  type DatabaseConnection,
  type DatabaseSettings,
  pingDatabase,
} from './database/index'

// Logging
export {
  createLogger,
  type Logger,
  type LoggerSettings,
} from './logging/logger'

// Mail
export { SmtpMailer, type SmtpSettings } from './mail/smtp-mailer'

// Repositories
export { AvailableSlotRepository } from './repositories/available-slot.repository.impl'
export { BookingRepository } from './repositories/booking.repository.impl'
export { CustomerRepository } from './repositories/customer.repository.impl'
export { CustomerPreferencesRepository } from './repositories/customer-preferences.repository.impl'
export { InventoryRepository } from './repositories/inventory.repository.impl'
export { PaymentRepository } from './repositories/payment.repository.impl'
export { PaymentMethodRepository } from './repositories/payment-method.repository.impl'
export { PointRepository } from './repositories/point.repository.impl'
export { ProductRepository } from './repositories/product.repository.impl'
export { PurchaseOrderRepository } from './repositories/purchase-order.repository.impl'
export { ReviewRepository } from './repositories/review.repository.impl'
export { ReviewReportRepository } from './repositories/review-report.repository.impl'
export { SaleRepository } from './repositories/sale.repository.impl'
export { SalesReportRepository } from './repositories/sales-report.repository.impl'
export { SalonRepository } from './repositories/salon.repository.impl'
export { ServiceRepository } from './repositories/service.repository.impl'
export { ServiceCategoryRepository } from './repositories/service-category.repository.impl'
export { SessionRepository } from './repositories/session.repository.impl'
export { StaffRepository } from './repositories/staff.repository.impl'
export { StaffAccountRepository } from './repositories/staff-account.repository.impl'
export { StaffInvitationRepository } from './repositories/staff-invitation.repository.impl'
export { StaffProfileRepository } from './repositories/staff-profile.repository.impl'
export { StaffScheduleRepository } from './repositories/staff-schedule.repository.impl'
export { UserRepository } from './repositories/user.repository.impl'

// Passwords, tokens and the numbers of bookings, sales, payments and
// purchase orders
export { Argon2PasswordHasher } from './security/argon2-password-hasher'
export { RandomBookingNumberIssuer } from './security/random-booking-number-issuer'
export { RandomPaymentNumberIssuer } from './security/random-payment-number-issuer'
export { RandomPurchaseOrderNumberIssuer } from './security/random-purchase-order-number-issuer'
export { RandomSaleNumberIssuer } from './security/random-sale-number-issuer'
export { RandomTokenIssuer } from './security/random-token-issuer'
export { TotpAuthenticator } from './security/totp-authenticator'
