import { Card, Note, useSay } from '@beauty-salon-frontend/ui'
import { adminShareLinkMessages } from '@beauty-salon-shared/i18n/messages/admin'

/**
 * The share links of a file, to an account that shares no file: who does.
 * The account issues none and sees none.
 */
export const NotTheirsToShare = () => {
  const say = useSay()

  return (
    <Card title={say(adminShareLinkMessages.list.title)}>
      <Note>{say(adminShareLinkMessages.sharers)}</Note>
    </Card>
  )
}
