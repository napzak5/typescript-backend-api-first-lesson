import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, PageHeader, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { settingsHrefOf } from '../../navigation'
import { mayAddSalon, mayKeepSalon, mayRemoveSalon } from '../api/settings-api'

const { keepers } = adminSettingsMessages

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

type SettingsForbiddenProps = {
  salon: ModelsSalonResponse
  title: LocalizedText
}

/** What a screen that changes the settings says to an account whose role does not change them. */
export const SettingsForbidden = ({ salon, title }: SettingsForbiddenProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader title={say(title)} description={salon.name} />
      <p>{say(keepers.forbidden)}</p>
      <ButtonLink href={settingsHrefOf(salon.id)}>
        {say(keepers.back)}
      </ButtonLink>
    </>
  )
}
