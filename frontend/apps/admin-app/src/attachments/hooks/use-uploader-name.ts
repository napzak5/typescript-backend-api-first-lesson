import { useSession } from '@beauty-salon-frontend/session'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { match } from 'ts-pattern'
import { readWholeLedger, STAFF_LISTS } from '../../staff/api/staff-api'
import { mayKeepStaffLedger } from '../../staff/utils/staff-format'
import { uploaderNameOf } from '../utils/attachment-file'

/**
 * Who uploaded a file, by the ID of its account: the account itself, or a
 * member by the name of the ledger. Only the owner and an administrator
 * read the ledger; to everyone else, another account is not named.
 */
export const useUploaderName = (
  salonId: string,
): ((uploadedBy: string) => LocalizedText) => {
  const session = useSession()
  const account = session.type === 'signedIn' ? session.user : undefined
  const ledger = useQuery({
    // Among the lists of the staff, which a write of a member drops
    queryKey: [...STAFF_LISTS, salonId, 'whole'],
    queryFn: () => readWholeLedger(salonId),
    enabled: mayKeepStaffLedger(account?.role ?? ''),
  })
  const members = match(ledger.data)
    .with({ type: 'found' }, ({ items }) => items)
    .otherwise(() => [])

  return (uploadedBy) => uploaderNameOf(uploadedBy, account?.id ?? '', members)
}
