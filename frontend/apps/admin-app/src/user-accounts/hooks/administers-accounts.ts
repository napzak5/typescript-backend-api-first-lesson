import { useSession } from '@beauty-salon-frontend/session'
import { administersAccounts } from '../utils/user-accounts'

/** Whether the signed-in account looks after the accounts of the users: an administrator. */
export const useAdministersAccounts = (): boolean => {
  const session = useSession()
  return session.type === 'signedIn' && administersAccounts(session.user.role)
}
