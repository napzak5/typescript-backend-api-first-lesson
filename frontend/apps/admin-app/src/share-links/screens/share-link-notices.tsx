import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { ButtonLink, PageHeader, useSay } from '@beauty-salon-frontend/ui'
import { adminShareLinkMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { attachmentHrefOf } from '../../navigation'

type FileOfTheAddress = { salonId: string; attachmentId: string }

/** The way back to the file of the address */
export const ToTheFile = ({ salonId, attachmentId }: FileOfTheAddress) => {
  const say = useSay()

  return (
    <ButtonLink href={attachmentHrefOf(salonId, attachmentId)}>
      {say(adminShareLinkMessages.toFile)}
    </ButtonLink>
  )
}

type SharingForbiddenProps = {
  title: string
  salon: ModelsSalonResponse
  attachmentId: string
}

/** What a screen of the share links says to a role that shares no file: who does, and the way back to the file. */
export const SharingForbidden = ({
  title,
  salon,
  attachmentId,
}: SharingForbiddenProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader title={title} description={salon.name} />
      <p>{say(adminShareLinkMessages.forbidden)}</p>
      <ToTheFile salonId={salon.id} attachmentId={attachmentId} />
    </>
  )
}

/** What the screen of a share link says when there is none to show: none at the address, one revoked, or one of another file. */
export const ShareLinkNotFound = ({
  salonId,
  attachmentId,
}: FileOfTheAddress) => {
  const say = useSay()
  const { notFound } = adminShareLinkMessages

  return (
    <>
      <PageHeader
        title={say(notFound.title)}
        description={say(notFound.description)}
      />
      <ToTheFile salonId={salonId} attachmentId={attachmentId} />
    </>
  )
}
