import {
  StaffApplication,
  type StaffApplicationProps,
} from '@beauty-salon-frontend/app-frame'
import { applications } from '@beauty-salon-frontend/brand'
import { StartScreen } from '@beauty-salon-frontend/salon-screens'
import { ButtonLink } from '@beauty-salon-frontend/ui'
import { Route } from 'react-router'
import { AttachmentScreen } from './attachments/screens/attachment-screen'
import { AttachmentsScreen } from './attachments/screens/attachments-screen'
import { BookingEntryScreen } from './bookings/screens/booking-entry-screen'
import { BookingLineEntryScreen } from './bookings/screens/booking-line-entry-screen'
import { BookingLineScreen } from './bookings/screens/booking-line-screen'
import { BookingMoveScreen } from './bookings/screens/booking-move-screen'
import { BookingNotesScreen } from './bookings/screens/booking-notes-screen'
import { BookingScreen } from './bookings/screens/booking-screen'
import { DayBookingsScreen } from './bookings/screens/day-bookings-screen'
import { AllergyChangeScreen } from './charts/screens/allergy-change-screen'
import { AllergyEntryScreen } from './charts/screens/allergy-entry-screen'
import { ChartChangeScreen } from './charts/screens/chart-change-screen'
import { ChartEntryScreen } from './charts/screens/chart-entry-screen'
import { ChartScreen } from './charts/screens/chart-screen'
import { ChartSearchScreen } from './charts/screens/chart-search-screen'
import { CustomerChangeScreen } from './customers/screens/customer-change-screen'
import { CustomerEntryScreen } from './customers/screens/customer-entry-screen'
import { CustomerHistoryScreen } from './customers/screens/customer-history-screen'
import { CustomerImportScreen } from './customers/screens/customer-import-screen'
import { CustomerLedgerScreen } from './customers/screens/customer-ledger-screen'
import { CustomerMergeScreen } from './customers/screens/customer-merge-screen'
import { CustomerPointsScreen } from './customers/screens/customer-points-screen'
import { CustomerPreferencesScreen } from './customers/screens/customer-preferences-screen'
import { CustomerScreen } from './customers/screens/customer-screen'
import { CustomerVersionScreen } from './customers/screens/customer-version-screen'
import { PointEntryScreen } from './customers/screens/point-entry-screen'
import { InventoryScreen } from './inventory/screens/inventory-screen'
import { MovementEntryScreen } from './inventory/screens/movement-entry-screen'
import { MovementsScreen } from './inventory/screens/movements-screen'
import { StockAlertsScreen } from './inventory/screens/stock-alerts-screen'
import { StockChangeScreen } from './inventory/screens/stock-change-screen'
import { StockCountScreen } from './inventory/screens/stock-count-screen'
import { StockEntryScreen } from './inventory/screens/stock-entry-screen'
import { StockRowScreen } from './inventory/screens/stock-row-screen'
import { StockValueScreen } from './inventory/screens/stock-value-screen'
import { CategoryChangeScreen } from './menu/screens/category-change-screen'
import { CategoryEntryScreen } from './menu/screens/category-entry-screen'
import { MenuScreen } from './menu/screens/menu-screen'
import { ServiceChangeScreen } from './menu/screens/service-change-screen'
import { ServiceEntryScreen } from './menu/screens/service-entry-screen'
import { ServiceScreen } from './menu/screens/service-screen'
import { ServicesChangeScreen } from './menu/screens/services-change-screen'
import {
  bookingsHrefOf,
  navigationFor,
  OPERATIONS_PATH,
  OWN_PROFILE_PATH,
  SALON_ENTRY_PATH,
} from './navigation'
import { OperationsScreen } from './operations/screens/operations-screen'
import { OwnProfileScreen } from './own-profile/screens/own-profile-screen'
import { PaymentMethodChangeScreen } from './payment-methods/screens/payment-method-change-screen'
import { PaymentMethodEntryScreen } from './payment-methods/screens/payment-method-entry-screen'
import { PaymentMethodScreen } from './payment-methods/screens/payment-method-screen'
import { PaymentMethodsScreen } from './payment-methods/screens/payment-methods-screen'
import { ProductChangeScreen } from './products/screens/product-change-screen'
import { ProductEntryScreen } from './products/screens/product-entry-screen'
import { ProductScreen } from './products/screens/product-screen'
import { ProductsScreen } from './products/screens/products-screen'
import { PurchaseOrderChangeScreen } from './purchase-orders/screens/purchase-order-change-screen'
import { PurchaseOrderEntryScreen } from './purchase-orders/screens/purchase-order-entry-screen'
import { PurchaseOrderReceiptScreen } from './purchase-orders/screens/purchase-order-receipt-screen'
import { PurchaseOrderScreen } from './purchase-orders/screens/purchase-order-screen'
import { PurchaseOrdersScreen } from './purchase-orders/screens/purchase-orders-screen'
import { ReorderSuggestionsScreen } from './purchase-orders/screens/reorder-suggestions-screen'
import { ReviewReportsScreen } from './review-reports/screens/review-reports-screen'
import { ReviewResponseScreen } from './reviews/screens/review-response-screen'
import { ReviewScreen } from './reviews/screens/review-screen'
import { ReviewsScreen } from './reviews/screens/reviews-screen'
import { CheckoutScreen } from './sales/screens/checkout-screen'
import { PaymentEntryScreen } from './sales/screens/payment-entry-screen'
import { ReceiptScreen } from './sales/screens/receipt-screen'
import { RefundScreen } from './sales/screens/refund-screen'
import { SaleChangeScreen } from './sales/screens/sale-change-screen'
import { SaleScreen } from './sales/screens/sale-screen'
import { SalesLedgerScreen } from './sales/screens/sales-ledger-screen'
import { HoursChangeScreen } from './settings/screens/hours-change-screen'
import { SalonChangeScreen } from './settings/screens/salon-change-screen'
import { SalonEntryScreen } from './settings/screens/salon-entry-screen'
import { SettingsScreen } from './settings/screens/settings-screen'
import { ShareLinkEntryScreen } from './share-links/screens/share-link-entry-screen'
import { ShareLinkScreen } from './share-links/screens/share-link-screen'
import { ScheduleChangeScreen } from './shifts/screens/schedule-change-screen'
import { ScheduleScreen } from './shifts/screens/schedule-screen'
import { ShiftsScreen } from './shifts/screens/shifts-screen'
import { StaffChangeScreen } from './staff/screens/staff-change-screen'
import { StaffEntryScreen } from './staff/screens/staff-entry-screen'
import { StaffLedgerScreen } from './staff/screens/staff-ledger-screen'
import { StaffMemberScreen } from './staff/screens/staff-member-screen'
import { StaffAccountScreen } from './staff-accounts/screens/staff-account-screen'
import { TreatmentChangeScreen } from './treatments/screens/treatment-change-screen'
import { TreatmentEntryScreen } from './treatments/screens/treatment-entry-screen'
import { TreatmentPhotosScreen } from './treatments/screens/treatment-photos-screen'
import { TreatmentScreen } from './treatments/screens/treatment-screen'
import { TreatmentStatisticsScreen } from './treatments/screens/treatment-statistics-screen'
import { TreatmentsScreen } from './treatments/screens/treatments-screen'
import { UserAccountScreen } from './user-accounts/screens/user-account-screen'

/** Who this application is for: the people who work at a salon, and the operator of the platform */
const ROLES: StaffApplicationProps['roles'] = [
  'owner',
  'manager',
  'staff',
  'admin',
]

export const App = () => (
  <StaffApplication
    title={applications.admin.name}
    roles={ROLES}
    navigationFor={navigationFor}
    environment={import.meta.env.VITE_MODE}
    portalUrl={import.meta.env.VITE_PORTAL_APP_URL}
  >
    <Route
      path='/'
      element={
        <StartScreen
          title={applications.admin.name}
          choice='予約台帳を開くサロンを選びます。'
          salonHref={bookingsHrefOf}
          choiceActions={
            <ButtonLink href={SALON_ENTRY_PATH} variant='primary'>
              サロンを登録する
            </ButtonLink>
          }
        />
      }
    />
    <Route path={SALON_ENTRY_PATH} element={<SalonEntryScreen />} />
    <Route path='/users/:userId' element={<UserAccountScreen />} />
    <Route path={OPERATIONS_PATH} element={<OperationsScreen />} />
    <Route path='/salons/:salonId/bookings' element={<DayBookingsScreen />} />
    <Route
      path='/salons/:salonId/bookings/new'
      element={<BookingEntryScreen />}
    />
    <Route
      path='/salons/:salonId/bookings/:bookingId'
      element={<BookingScreen />}
    />
    <Route
      path='/salons/:salonId/bookings/:bookingId/edit'
      element={<BookingNotesScreen />}
    />
    <Route
      path='/salons/:salonId/bookings/:bookingId/reschedule'
      element={<BookingMoveScreen />}
    />
    <Route
      path='/salons/:salonId/bookings/:bookingId/services/new'
      element={<BookingLineEntryScreen />}
    />
    <Route
      path='/salons/:salonId/bookings/:bookingId/services/:lineId'
      element={<BookingLineScreen />}
    />
    <Route
      path='/salons/:salonId/bookings/:bookingId/checkout'
      element={<CheckoutScreen />}
    />
    <Route
      path='/salons/:salonId/bookings/:bookingId/treatment/new'
      element={<TreatmentEntryScreen />}
    />
    <Route path='/salons/:salonId/sales' element={<SalesLedgerScreen />} />
    <Route path='/salons/:salonId/sales/:saleId' element={<SaleScreen />} />
    <Route
      path='/salons/:salonId/sales/:saleId/payments/new'
      element={<PaymentEntryScreen />}
    />
    <Route
      path='/salons/:salonId/sales/:saleId/receipt'
      element={<ReceiptScreen />}
    />
    <Route
      path='/salons/:salonId/sales/:saleId/edit'
      element={<SaleChangeScreen />}
    />
    <Route
      path='/salons/:salonId/sales/:saleId/payments/:paymentId/refund'
      element={<RefundScreen />}
    />
    <Route
      path='/salons/:salonId/customers'
      element={<CustomerLedgerScreen />}
    />
    <Route
      path='/salons/:salonId/customers/new'
      element={<CustomerEntryScreen />}
    />
    <Route
      path='/salons/:salonId/customers/import'
      element={<CustomerImportScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId'
      element={<CustomerScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/edit'
      element={<CustomerChangeScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/preferences'
      element={<CustomerPreferencesScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/history'
      element={<CustomerHistoryScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/history/:version'
      element={<CustomerVersionScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/merge'
      element={<CustomerMergeScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/points'
      element={<CustomerPointsScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/points/new'
      element={<PointEntryScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/chart'
      element={<ChartScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/chart/new'
      element={<ChartEntryScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/chart/edit'
      element={<ChartChangeScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/chart/allergies/new'
      element={<AllergyEntryScreen />}
    />
    <Route
      path='/salons/:salonId/customers/:customerId/chart/allergies/:allergyId/edit'
      element={<AllergyChangeScreen />}
    />
    <Route
      path='/salons/:salonId/customers/charts'
      element={<ChartSearchScreen />}
    />
    <Route path='/salons/:salonId/treatments' element={<TreatmentsScreen />} />
    <Route
      path='/salons/:salonId/treatments/statistics'
      element={<TreatmentStatisticsScreen />}
    />
    <Route
      path='/salons/:salonId/treatments/:treatmentId'
      element={<TreatmentScreen />}
    />
    <Route
      path='/salons/:salonId/treatments/:treatmentId/edit'
      element={<TreatmentChangeScreen />}
    />
    <Route
      path='/salons/:salonId/treatments/:treatmentId/photos/new'
      element={<TreatmentPhotosScreen />}
    />
    <Route path='/salons/:salonId/staff' element={<StaffLedgerScreen />} />
    <Route path='/salons/:salonId/staff/new' element={<StaffEntryScreen />} />
    <Route
      path='/salons/:salonId/staff/:staffId'
      element={<StaffMemberScreen />}
    />
    <Route
      path='/salons/:salonId/staff/:staffId/edit'
      element={<StaffChangeScreen />}
    />
    <Route
      path='/salons/:salonId/staff/:staffId/account'
      element={<StaffAccountScreen />}
    />
    <Route path='/salons/:salonId/shifts' element={<ShiftsScreen />} />
    <Route
      path='/salons/:salonId/shifts/:staffId'
      element={<ScheduleScreen />}
    />
    <Route
      path='/salons/:salonId/shifts/:staffId/edit'
      element={<ScheduleChangeScreen />}
    />
    <Route path='/salons/:salonId/menu' element={<MenuScreen />} />
    <Route
      path='/salons/:salonId/menu/services/new'
      element={<ServiceEntryScreen />}
    />
    <Route
      path='/salons/:salonId/menu/services/bulk'
      element={<ServicesChangeScreen />}
    />
    <Route
      path='/salons/:salonId/menu/services/:serviceId'
      element={<ServiceScreen />}
    />
    <Route
      path='/salons/:salonId/menu/services/:serviceId/edit'
      element={<ServiceChangeScreen />}
    />
    <Route
      path='/salons/:salonId/menu/categories/new'
      element={<CategoryEntryScreen />}
    />
    <Route
      path='/salons/:salonId/menu/categories/:categoryId/edit'
      element={<CategoryChangeScreen />}
    />
    <Route path='/salons/:salonId/products' element={<ProductsScreen />} />
    <Route
      path='/salons/:salonId/products/new'
      element={<ProductEntryScreen />}
    />
    <Route
      path='/salons/:salonId/products/:productId'
      element={<ProductScreen />}
    />
    <Route
      path='/salons/:salonId/products/:productId/edit'
      element={<ProductChangeScreen />}
    />
    <Route path='/salons/:salonId/inventory' element={<InventoryScreen />} />
    <Route
      path='/salons/:salonId/inventory/new'
      element={<StockEntryScreen />}
    />
    <Route
      path='/salons/:salonId/inventory/count'
      element={<StockCountScreen />}
    />
    <Route
      path='/salons/:salonId/inventory/value'
      element={<StockValueScreen />}
    />
    <Route
      path='/salons/:salonId/inventory/alerts'
      element={<StockAlertsScreen />}
    />
    <Route
      path='/salons/:salonId/inventory/:inventoryId'
      element={<StockRowScreen />}
    />
    <Route
      path='/salons/:salonId/inventory/:inventoryId/edit'
      element={<StockChangeScreen />}
    />
    <Route
      path='/salons/:salonId/inventory/:inventoryId/movements'
      element={<MovementsScreen />}
    />
    <Route
      path='/salons/:salonId/inventory/:inventoryId/movements/new'
      element={<MovementEntryScreen />}
    />
    <Route
      path='/salons/:salonId/purchase-orders'
      element={<PurchaseOrdersScreen />}
    />
    <Route
      path='/salons/:salonId/purchase-orders/new'
      element={<PurchaseOrderEntryScreen />}
    />
    <Route
      path='/salons/:salonId/purchase-orders/:purchaseOrderId'
      element={<PurchaseOrderScreen />}
    />
    <Route
      path='/salons/:salonId/purchase-orders/suggestions'
      element={<ReorderSuggestionsScreen />}
    />
    <Route
      path='/salons/:salonId/purchase-orders/:purchaseOrderId/edit'
      element={<PurchaseOrderChangeScreen />}
    />
    <Route
      path='/salons/:salonId/purchase-orders/:purchaseOrderId/receive'
      element={<PurchaseOrderReceiptScreen />}
    />
    <Route path='/salons/:salonId/reviews' element={<ReviewsScreen />} />
    <Route
      path='/salons/:salonId/reviews/reports'
      element={<ReviewReportsScreen />}
    />
    <Route
      path='/salons/:salonId/reviews/:reviewId'
      element={<ReviewScreen />}
    />
    <Route
      path='/salons/:salonId/reviews/:reviewId/response'
      element={<ReviewResponseScreen />}
    />
    <Route path='/salons/:salonId/files' element={<AttachmentsScreen />} />
    <Route
      path='/salons/:salonId/files/:attachmentId'
      element={<AttachmentScreen />}
    />
    <Route
      path='/salons/:salonId/files/:attachmentId/share-links/new'
      element={<ShareLinkEntryScreen />}
    />
    <Route
      path='/salons/:salonId/files/:attachmentId/share-links/:shareLinkId'
      element={<ShareLinkScreen />}
    />
    <Route path='/salons/:salonId/settings' element={<SettingsScreen />} />
    <Route
      path='/salons/:salonId/settings/edit'
      element={<SalonChangeScreen />}
    />
    <Route
      path='/salons/:salonId/settings/hours'
      element={<HoursChangeScreen />}
    />
    <Route
      path='/salons/:salonId/settings/payment-methods'
      element={<PaymentMethodsScreen />}
    />
    <Route
      path='/salons/:salonId/settings/payment-methods/new'
      element={<PaymentMethodEntryScreen />}
    />
    <Route
      path='/salons/:salonId/settings/payment-methods/:paymentMethodId'
      element={<PaymentMethodScreen />}
    />
    <Route
      path='/salons/:salonId/settings/payment-methods/:paymentMethodId/edit'
      element={<PaymentMethodChangeScreen />}
    />
    <Route path={OWN_PROFILE_PATH} element={<OwnProfileScreen />} />
  </StaffApplication>
)
