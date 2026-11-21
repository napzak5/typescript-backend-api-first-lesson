import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, PageHeader } from '@beauty-salon-frontend/ui'
import { settingsHrefOf } from '../navigation'
import { mayAddSalon, mayKeepSalon, mayRemoveSalon } from './settings-api'

/** Whether the signed-in account has a role that changes the settings: the owner, a manager and an administrator. */
export const useKeepsSalon = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayKeepSalon(session.user.role)
}

/** Whether the signed-in account has a role that adds salons: an administrator. */
export const useAddsSalon = (): boolean => {
  const session = useSession()
  return session.type === 'signedIn' && mayAddSalon(session.user.role)
}

/** Whether the signed-in account has a role that removes its salon: the owner and an administrator. */
export const useRemovesSalon = (): boolean => {
  const session = useSession()
  return session.type === 'signedIn' && mayRemoveSalon(session.user.role)
}

type SettingsForbiddenProps = { salon: ModelsSalonResponse; title: string }

/** What a screen that changes the settings says to an account whose role does not change them. */
export const SettingsForbidden = ({ salon, title }: SettingsForbiddenProps) => (
  <>
    <PageHeader title={title} description={salon.name} />
    <p>
      このアカウントでは、サロンの設定を変えられません。設定を変えられるのは、サロンのオーナーとマネージャーと、管理者です。
    </p>
    <p>
      <ButtonLink href={settingsHrefOf(salon.id)}>設定へ戻る</ButtonLink>
    </p>
  </>
)
