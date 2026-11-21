import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, PageHeader } from '@beauty-salon-frontend/ui'
import { menuHrefOf } from '../navigation'
import { mayKeepMenu } from './menu-api'

/** Whether the signed-in account has a role that changes the menu: the owner, a manager and an administrator. */
export const useKeepsMenu = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayKeepMenu(session.user.role)
}

type MenuForbiddenProps = { salon: ModelsSalonResponse; title: string }

/** What a screen that changes the menu says to an account whose role does not change it. */
export const MenuForbidden = ({ salon, title }: MenuForbiddenProps) => (
  <>
    <PageHeader title={title} description={salon.name} />
    <p>
      このアカウントでは、メニューを変えられません。メニューを変えられるのは、サロンのオーナーとマネージャーと、管理者です。
    </p>
    <ButtonLink href={menuHrefOf(salon.id)}>メニューへ戻る</ButtonLink>
  </>
)
