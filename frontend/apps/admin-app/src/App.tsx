import {
  AccountSecurityScreen,
  PasswordChangeScreen,
  RequireSession,
  type RequireSessionProps,
  SessionAccount,
  TwoFactorSetupScreen,
  useSession,
} from '@beauty-salon-frontend/session'
import {
  AppShell,
  ButtonLink,
  EnvironmentBanner,
  type LinkComponent,
  LinkProvider,
  Navigation,
  NotificationProvider,
  PageHeader,
} from '@beauty-salon-frontend/ui'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router'
import { BookingEntryScreen } from './bookings/booking-entry-screen'
import { BookingLineEntryScreen } from './bookings/booking-line-entry-screen'
import { BookingLineScreen } from './bookings/booking-line-screen'
import { BookingMoveScreen } from './bookings/booking-move-screen'
import { BookingNotesScreen } from './bookings/booking-notes-screen'
import { BookingScreen } from './bookings/booking-screen'
import { DayBookingsScreen } from './bookings/day-bookings-screen'
import { AllergyChangeScreen } from './charts/allergy-change-screen'
import { AllergyEntryScreen } from './charts/allergy-entry-screen'
import { ChartChangeScreen } from './charts/chart-change-screen'
import { ChartEntryScreen } from './charts/chart-entry-screen'
import { ChartScreen } from './charts/chart-screen'
import { ChartSearchScreen } from './charts/chart-search-screen'
import { CustomerChangeScreen } from './customers/customer-change-screen'
import { CustomerEntryScreen } from './customers/customer-entry-screen'
import { CustomerHistoryScreen } from './customers/customer-history-screen'
import { CustomerImportScreen } from './customers/customer-import-screen'
import { CustomerLedgerScreen } from './customers/customer-ledger-screen'
import { CustomerMergeScreen } from './customers/customer-merge-screen'
import { CustomerPointsScreen } from './customers/customer-points-screen'
import { CustomerPreferencesScreen } from './customers/customer-preferences-screen'
import { CustomerScreen } from './customers/customer-screen'
import { CustomerVersionScreen } from './customers/customer-version-screen'
import { PointEntryScreen } from './customers/point-entry-screen'
import { HomeScreen } from './home-screen'
import { InventoryScreen } from './inventory/inventory-screen'
import { MovementEntryScreen } from './inventory/movement-entry-screen'
import { MovementsScreen } from './inventory/movements-screen'
import { StockChangeScreen } from './inventory/stock-change-screen'
import { StockCountScreen } from './inventory/stock-count-screen'
import { StockEntryScreen } from './inventory/stock-entry-screen'
import { StockRowScreen } from './inventory/stock-row-screen'
import { StockValueScreen } from './inventory/stock-value-screen'
import { CategoryChangeScreen } from './menu/category-change-screen'
import { CategoryEntryScreen } from './menu/category-entry-screen'
import { MenuScreen } from './menu/menu-screen'
import { ServiceChangeScreen } from './menu/service-change-screen'
import { ServiceEntryScreen } from './menu/service-entry-screen'
import { ServiceScreen } from './menu/service-screen'
import { ServicesChangeScreen } from './menu/services-change-screen'
import { navigationFor, OWN_PROFILE_PATH } from './navigation'
import { OwnProfileScreen } from './own-profile/own-profile-screen'
import { PaymentMethodChangeScreen } from './payment-methods/payment-method-change-screen'
import { PaymentMethodEntryScreen } from './payment-methods/payment-method-entry-screen'
import { PaymentMethodScreen } from './payment-methods/payment-method-screen'
import { PaymentMethodsScreen } from './payment-methods/payment-methods-screen'
import { ProductChangeScreen } from './products/product-change-screen'
import { ProductEntryScreen } from './products/product-entry-screen'
import { ProductScreen } from './products/product-screen'
import { ProductsScreen } from './products/products-screen'
import { CheckoutScreen } from './sales/checkout-screen'
import { PaymentEntryScreen } from './sales/payment-entry-screen'
import { ReceiptScreen } from './sales/receipt-screen'
import { RefundScreen } from './sales/refund-screen'
import { SaleChangeScreen } from './sales/sale-change-screen'
import { SaleScreen } from './sales/sale-screen'
import { SalesLedgerScreen } from './sales/sales-ledger-screen'
import { HoursChangeScreen } from './settings/hours-change-screen'
import { SalonChangeScreen } from './settings/salon-change-screen'
import { SettingsScreen } from './settings/settings-screen'
import { ScheduleChangeScreen } from './shifts/schedule-change-screen'
import { ScheduleScreen } from './shifts/schedule-screen'
import { ShiftsScreen } from './shifts/shifts-screen'
import { StaffChangeScreen } from './staff/staff-change-screen'
import { StaffEntryScreen } from './staff/staff-entry-screen'
import { StaffLedgerScreen } from './staff/staff-ledger-screen'
import { StaffMemberScreen } from './staff/staff-member-screen'
import { StaffAccountScreen } from './staff-accounts/staff-account-screen'
import { TreatmentChangeScreen } from './treatments/treatment-change-screen'
import { TreatmentEntryScreen } from './treatments/treatment-entry-screen'
import { TreatmentPhotosScreen } from './treatments/treatment-photos-screen'
import { TreatmentScreen } from './treatments/treatment-screen'
import { TreatmentStatisticsScreen } from './treatments/treatment-statistics-screen'
import { TreatmentsScreen } from './treatments/treatments-screen'

/** Who this application is for: the people who work at a salon, and the operator of the platform */
const ROLES: RequireSessionProps['roles'] = [
  'owner',
  'manager',
  'staff',
  'admin',
]

/** The links that the shared components draw move within the application */
const RouterLink: LinkComponent = ({ href, ...rest }) => (
  <Link {...rest} to={href} />
)

/**
 * The way on for somebody who cannot sign in. A password is set anew in the
 * portal, where the link of the mail leads for every account.
 */
const SignInHelp = () => (
  <p>
    <a href={`${import.meta.env.VITE_PORTAL_APP_URL}/forgot-password`}>
      パスワードを忘れた場合
    </a>
  </p>
)

/** Where the screens of the security of the account are: the header leads to them */
const SECURITY_PATH = '/account/security'
const PASSWORD_PATH = `${SECURITY_PATH}/password`
const TWO_FACTOR_PATH = `${SECURITY_PATH}/two-factor`

const PasswordPage = () => {
  const navigate = useNavigate()

  return (
    <PasswordChangeScreen
      securityHref={SECURITY_PATH}
      onChanged={() => void navigate(SECURITY_PATH)}
    />
  )
}

const NotFoundPage = () => (
  <>
    <PageHeader
      title='ページが見つかりません'
      description='アドレスが正しいか、お確かめください。'
    />
    <p>
      <ButtonLink href='/' variant='secondary'>
        トップへ戻る
      </ButtonLink>
    </p>
  </>
)

export const App = () => {
  const session = useSession()
  const { pathname } = useLocation()
  const items = navigationFor(
    session.type === 'signedIn' ? session.user.role : undefined,
    pathname,
  )

  return (
    <LinkProvider component={RouterLink}>
      <NotificationProvider>
        <AppShell
          title={import.meta.env.VITE_APP_TITLE}
          account={<SessionAccount securityHref={SECURITY_PATH} />}
          navigation={
            items.length > 0 ? (
              <Navigation label='メインメニュー' items={items} />
            ) : undefined
          }
        >
          {/* Every screen needs a session: who is not signed in signs in here, at the address they asked for */}
          <RequireSession roles={ROLES} signInHelp={<SignInHelp />}>
            <Routes>
              <Route path='/' element={<HomeScreen />} />
              <Route
                path='/salons/:salonId/bookings'
                element={<DayBookingsScreen />}
              />
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
              <Route
                path='/salons/:salonId/sales'
                element={<SalesLedgerScreen />}
              />
              <Route
                path='/salons/:salonId/sales/:saleId'
                element={<SaleScreen />}
              />
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
              <Route
                path='/salons/:salonId/treatments'
                element={<TreatmentsScreen />}
              />
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
              <Route
                path='/salons/:salonId/staff'
                element={<StaffLedgerScreen />}
              />
              <Route
                path='/salons/:salonId/staff/new'
                element={<StaffEntryScreen />}
              />
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
              <Route
                path='/salons/:salonId/shifts'
                element={<ShiftsScreen />}
              />
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
              <Route
                path='/salons/:salonId/products'
                element={<ProductsScreen />}
              />
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
              <Route
                path='/salons/:salonId/inventory'
                element={<InventoryScreen />}
              />
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
                path='/salons/:salonId/settings'
                element={<SettingsScreen />}
              />
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
              <Route
                path={SECURITY_PATH}
                element={
                  <AccountSecurityScreen
                    passwordHref={PASSWORD_PATH}
                    twoFactorHref={TWO_FACTOR_PATH}
                  />
                }
              />
              <Route path={PASSWORD_PATH} element={<PasswordPage />} />
              <Route
                path={TWO_FACTOR_PATH}
                element={<TwoFactorSetupScreen securityHref={SECURITY_PATH} />}
              />
              <Route path='*' element={<NotFoundPage />} />
            </Routes>
          </RequireSession>
        </AppShell>
      </NotificationProvider>
      <EnvironmentBanner environment={import.meta.env.VITE_MODE} />
    </LinkProvider>
  )
}
