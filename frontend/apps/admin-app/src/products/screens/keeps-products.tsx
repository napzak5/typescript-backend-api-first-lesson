import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, PageHeader, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { productsHrefOf } from '../../navigation'
import { mayKeepProducts } from '../api/products-api'

const { keepers, notFound, words } = adminProductMessages

/** Whether the signed-in account has a role that keeps the products: the owner, a manager and an administrator. */
export const useKeepsProducts = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayKeepProducts(session.user.role)
}

type ProductsForbiddenProps = {
  salon: ModelsSalonResponse
  title: LocalizedText
}

/** What a screen that changes the products says to an account whose role does not change them. */
export const ProductsForbidden = ({ salon, title }: ProductsForbiddenProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader title={say(title)} description={salon.name} />
      <p>{say(keepers.forbidden)}</p>
      <ButtonLink href={productsHrefOf(salon.id)}>
        {say(keepers.back)}
      </ButtonLink>
    </>
  )
}

/** What a screen of a product says when there is none to show. */
export const ProductNotFound = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()

  return (
    <>
      <PageHeader
        title={say(notFound.title)}
        description={say(notFound.description)}
      />
      <ButtonLink href={productsHrefOf(salon.id)}>
        {say(words.toLedger)}
      </ButtonLink>
    </>
  )
}
