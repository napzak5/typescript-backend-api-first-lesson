import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, PageHeader } from '@beauty-salon-frontend/ui'
import { inventoryHrefOf } from '../navigation'
import { mayKeepStock } from './inventory-api'

/** Whether the signed-in account has a role that keeps the stock rows: the owner, a manager and an administrator. */
export const useKeepsStock = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayKeepStock(session.user.role)
}

type StockForbiddenProps = {
  salon: ModelsSalonResponse
  title: string
  /** What the account may not do here, and who may; by default, change the rows */
  message?: string | undefined
}

/** What a screen for the keepers of the stock says to an account whose role does not keep it. */
export const StockForbidden = ({
  salon,
  title,
  message = 'このアカウントでは、在庫の行を変えられません。在庫の行を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
}: StockForbiddenProps) => (
  <>
    <PageHeader title={title} description={salon.name} />
    <p>{message}</p>
    <p>
      <ButtonLink href={inventoryHrefOf(salon.id)}>在庫へ戻る</ButtonLink>
    </p>
  </>
)

/** What a screen of a stock row says when there is none to show. */
export const StockRowNotFound = ({ salon }: { salon: ModelsSalonResponse }) => (
  <>
    <PageHeader
      title='在庫の行が見つかりません'
      description='アドレスが正しいか、お確かめください。削除した在庫の行は、表示できません。'
    />
    <p>
      <ButtonLink href={inventoryHrefOf(salon.id)}>在庫へ</ButtonLink>
    </p>
  </>
)
