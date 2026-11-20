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
import { navigationFor } from './navigation'
import { CheckoutScreen } from './sales/checkout-screen'
import { PaymentEntryScreen } from './sales/payment-entry-screen'
import { ReceiptScreen } from './sales/receipt-screen'
import { RefundScreen } from './sales/refund-screen'
import { SaleChangeScreen } from './sales/sale-change-screen'
import { SaleScreen } from './sales/sale-screen'
import { SalesLedgerScreen } from './sales/sales-ledger-screen'

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
                path='/salons/:salonId/customers/charts'
                element={<ChartSearchScreen />}
              />
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
