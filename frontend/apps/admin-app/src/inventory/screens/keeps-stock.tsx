import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, PageHeader, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { inventoryHrefOf } from '../../navigation'
import { mayKeepStock } from '../api/inventory-api'

const { keepers, notFound, words } = adminInventoryMessages

/** Whether the signed-in account has a role that keeps the stock rows: the owner, a manager and an administrator. */
export const useKeepsStock = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayKeepStock(session.user.role)
}

type StockForbiddenProps = {
  salon: ModelsSalonResponse
  title: LocalizedText
  /** What the account may not do here, and who may; by default, change the rows */
  message?: LocalizedText | undefined
}

/** What a screen for the keepers of the stock says to an account whose role does not keep it. */
export const StockForbidden = ({
  salon,
  title,
  message = keepers.rowsForbidden,
}: StockForbiddenProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader title={say(title)} description={salon.name} />
      <p>{say(message)}</p>
      <ButtonLink href={inventoryHrefOf(salon.id)}>
        {say(keepers.back)}
      </ButtonLink>
    </>
  )
}

/** What a screen of a stock row says when there is none to show. */
export const StockRowNotFound = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()

  return (
    <>
      <PageHeader
        title={say(notFound.title)}
        description={say(notFound.description)}
      />
      <ButtonLink href={inventoryHrefOf(salon.id)}>
        {say(words.toInventory)}
      </ButtonLink>
    </>
  )
}
