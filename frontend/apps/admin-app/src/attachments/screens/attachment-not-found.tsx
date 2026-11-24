import { ButtonLink, PageHeader, useSay } from '@beauty-salon-frontend/ui'
import { adminAttachmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { attachmentsHrefOf } from '../../navigation'

const { notFound } = adminAttachmentMessages

/** The way back to the files of the salon */
export const ToTheFiles = ({ salonId }: { salonId: string }) => {
  const say = useSay()

  return (
    <ButtonLink href={attachmentsHrefOf(salonId)}>
      {say(notFound.toList)}
    </ButtonLink>
  )
}

/** What the screen of a file says when there is none to show: none at the address, one removed, or one of another salon. */
export const AttachmentNotFound = ({ salonId }: { salonId: string }) => {
  const say = useSay()

  return (
    <>
      <PageHeader
        title={say(notFound.title)}
        description={say(notFound.description)}
      />
      <ToTheFiles salonId={salonId} />
    </>
  )
}
