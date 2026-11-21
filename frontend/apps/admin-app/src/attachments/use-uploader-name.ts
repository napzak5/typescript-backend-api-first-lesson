import { useSession } from '@beauty-salon-frontend/session'
import { useQuery } from '@tanstack/react-query'
import { match } from 'ts-pattern'
import { readWholeLedger, wholeLedgerKeyOf } from '../staff/staff-api'
import { mayKeepStaffLedger } from '../staff/staff-format'
import { uploaderNameOf } from './attachment-file'

/**
 * Who uploaded a file, by the ID of its account: the account itself, or a
 * member by the name of the ledger. Only the owner and an administrator
 * read the ledger; to everyone else, another account is not named.
 */
export const useUploaderName = (
  salonId: string,
): ((uploadedBy: string) => string) => {
  const session = useSession()
  const account = session.type === 'signedIn' ? session.user : undefined
  const ledger = useQuery({
    queryKey: wholeLedgerKeyOf(salonId),
    queryFn: () => readWholeLedger(salonId),
    enabled: mayKeepStaffLedger(account?.role ?? ''),
  })
  const members = match(ledger.data)
    .with({ type: 'found' }, ({ items }) => items)
    .otherwise(() => [])

  return (uploadedBy) => uploaderNameOf(uploadedBy, account?.id ?? '', members)
}
