import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, PageHeader, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { menuHrefOf } from '../../navigation'
import { mayKeepMenu } from '../api/menu-api'

const { keepers, words } = adminMenuMessages

/** Whether the signed-in account has a role that changes the menu: the owner, a manager and an administrator. */
export const useKeepsMenu = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayKeepMenu(session.user.role)
}

type MenuForbiddenProps = { salon: ModelsSalonResponse; title: LocalizedText }

/** What a screen that changes the menu says to an account whose role does not change it. */
export const MenuForbidden = ({ salon, title }: MenuForbiddenProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader title={say(title)} description={salon.name} />
      <p>{say(keepers.forbidden)}</p>
      <ButtonLink href={menuHrefOf(salon.id)}>{say(keepers.back)}</ButtonLink>
    </>
  )
}

type NotFoundProps = {
  salon: ModelsSalonResponse
  /** What there is none of: its title and what to check */
  said: { title: LocalizedText; description: LocalizedText }
}

/** What a screen of a category or a service says when there is none to show. */
export const MenuPartNotFound = ({ salon, said }: NotFoundProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader title={say(said.title)} description={say(said.description)} />
      <ButtonLink href={menuHrefOf(salon.id)}>{say(words.toMenu)}</ButtonLink>
    </>
  )
}
