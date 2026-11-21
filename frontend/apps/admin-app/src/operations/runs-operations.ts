import { useSession } from '@beauty-salon-frontend/session'
import { runsOperations } from './operations'

/** Whether the signed-in account runs the platform: an administrator. */
export const useRunsOperations = (): boolean => {
  const session = useSession()
  return session.type === 'signedIn' && runsOperations(session.user.role)
}
