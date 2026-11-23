import { PageHeader, useSay } from '@beauty-salon-frontend/ui'
import { sessionMessages } from '@beauty-salon-shared/i18n/messages/ui'

/**
 * The screen of an account of a salon role that no salon reaches: the
 * screens of a salon have nothing to show it until it joins one.
 */
export const NoSalonNotice = () => {
  const say = useSay()

  return (
    <PageHeader
      title={say(sessionMessages.noSalon.title)}
      description={say(sessionMessages.noSalon.description)}
    />
  )
}
