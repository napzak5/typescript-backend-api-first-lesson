import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, PageHeader } from '@beauty-salon-frontend/ui'
import { productsHrefOf } from '../navigation'
import { mayKeepProducts } from './products-api'

/** Whether the signed-in account has a role that keeps the products: the owner, a manager and an administrator. */
export const useKeepsProducts = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayKeepProducts(session.user.role)
}

type ProductsForbiddenProps = {
  salon: ModelsSalonResponse
  title: string
}

/** What a screen that changes the products says to an account whose role does not change them. */
export const ProductsForbidden = ({ salon, title }: ProductsForbiddenProps) => (
  <>
    <PageHeader title={title} description={salon.name} />
    <p>
      このアカウントでは、商品を変えられません。商品を変えられるのは、サロンのオーナーとマネージャーと、管理者です。
    </p>
    <p>
      <ButtonLink href={productsHrefOf(salon.id)} variant='secondary'>
        商品台帳へ戻る
      </ButtonLink>
    </p>
  </>
)

/** What a screen of a product says when there is none to show. */
export const ProductNotFound = ({ salon }: { salon: ModelsSalonResponse }) => (
  <>
    <PageHeader
      title='商品が見つかりません'
      description='アドレスが正しいか、お確かめください。削除した商品は、表示できません。'
    />
    <p>
      <ButtonLink href={productsHrefOf(salon.id)} variant='secondary'>
        商品台帳へ
      </ButtonLink>
    </p>
  </>
)
