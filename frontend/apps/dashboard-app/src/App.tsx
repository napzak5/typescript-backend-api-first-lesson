import {
  StaffApplication,
  type StaffApplicationProps,
} from '@beauty-salon-frontend/app-frame'
import { applications } from '@beauty-salon-frontend/brand'
import { StartScreen } from '@beauty-salon-frontend/salon-screens'
import { useSay } from '@beauty-salon-frontend/ui'
import { dashboardFrameMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import { Route } from 'react-router'
import { navigationFor, reportsHrefOf } from './navigation'
import { CategorySalesScreen } from './reports/screens/category-sales-screen'
import { DailySalesScreen } from './reports/screens/daily-sales-screen'
import { SalesReportScreen } from './reports/screens/sales-report-screen'
import { SalesTrendsScreen } from './reports/screens/sales-trends-screen'
import { StaffSalesScreen } from './reports/screens/staff-sales-screen'

/** Who this application is for: those who run a salon, and the operator of the platform */
const ROLES: StaffApplicationProps['roles'] = ['owner', 'manager', 'admin']

export const App = () => {
  const say = useSay()

  return (
    <StaffApplication
      title={applications.dashboard.name}
      roles={ROLES}
      navigationFor={navigationFor}
      environment={import.meta.env.VITE_MODE}
      portalUrl={import.meta.env.VITE_PORTAL_APP_URL}
    >
      <Route
        path='/'
        element={
          <StartScreen
            title={applications.dashboard.name}
            choice={say(dashboardFrameMessages.choice)}
            salonHref={reportsHrefOf}
          />
        }
      />
      <Route path='/salons/:salonId/reports' element={<SalesReportScreen />} />
      <Route
        path='/salons/:salonId/reports/trends'
        element={<SalesTrendsScreen />}
      />
      <Route
        path='/salons/:salonId/reports/daily'
        element={<DailySalesScreen />}
      />
      <Route
        path='/salons/:salonId/reports/staff'
        element={<StaffSalesScreen />}
      />
      <Route
        path='/salons/:salonId/reports/categories'
        element={<CategorySalesScreen />}
      />
    </StaffApplication>
  )
}
